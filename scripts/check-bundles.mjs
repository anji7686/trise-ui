import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
for (const app of ['customer', 'operations']) {
  const path = `dist/${app}/index.html`;
  const html = readFileSync(path, 'utf8');
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map(([, src]) => `dist/${app}${src.replace(/^\//, '/')}`);
  const bytes = scripts.reduce((sum, file) => sum + gzipSync(readFileSync(file)).length, 0);
  console.log(`${app}: ${bytes} compressed JS bytes across initial scripts (target <= 204800)`);
  if (bytes > 204800) process.exitCode = 1;
}
