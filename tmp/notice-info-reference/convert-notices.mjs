import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const roots = ['apps/customer/src', 'apps/operations/src'];
const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) walk(file);
    else if (/\.(tsx|ts)$/.test(file)) files.push(file);
  }
}
roots.forEach(walk);
let transformed = 0;
for (const file of files) {
  let source = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const replacements = [];
  function visit(node) {
    if (ts.isJsxElement(node)) {
      const opening = node.openingElement;
      const classAttr = opening.attributes.properties.find(attr => ts.isJsxAttribute(attr) && attr.name.getText(sf) === 'className');
      const roleAttr = opening.attributes.properties.find(attr => ts.isJsxAttribute(attr) && attr.name.getText(sf) === 'role');
      const className = classAttr?.initializer && ts.isStringLiteral(classAttr.initializer) ? classAttr.initializer.text : '';
      const inner = source.slice(opening.end, node.closingElement.getStart(sf));
      const plain = node.children.map(child => child.getText(sf).replace(/\s+/g, ' ').trim()).join(' ');
      const keepInline = /\b(?:loading|error|failed|unavailable|not available|cannot|can't|concluded|read.only|immutable|locked|is required|required before|no active|not applicable|awaiting|does not|doesn't|not sent|not enabled|not returned|without malware scanning|immediate danger|emergency services|safety concern)\b/i.test(plain)
        || /^\s*No\b/i.test(plain)
        || /^\s*<Status>/i.test(plain)
        || /^\s*Report:/i.test(plain)
        || /^\s*Selected customer:/i.test(plain)
        || /^\s*\{\s*(?:t\(['"](?:loading|noProvider)|profileMessage|notice|error)/i.test(plain);
      if (className === 'notice' && !roleAttr && !keepInline) {
        replacements.push({ start: node.getStart(sf), end: node.end, text: `<InfoNotice>${inner}</InfoNotice>` });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  if (!replacements.length) continue;
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    source = source.slice(0, replacement.start) + replacement.text + source.slice(replacement.end);
  }
  const importPattern = /import\s*\{([^}]*)\}\s*from\s*(['"])@trise\/ui\2\s*;?/;
  const match = source.match(importPattern);
  if (match) {
    if (!/\bInfoNotice\b/.test(match[1])) {
      source = source.replace(importPattern, `import { ${match[1].trim()}, InfoNotice } from ${match[2]}@trise/ui${match[2]};`);
    }
  } else {
    const reactImport = source.match(/import[^\n]*from\s*(['"])react\1\s*;?/);
    const insertAt = reactImport ? reactImport.index + reactImport[0].length : 0;
    source = source.slice(0, insertAt) + `\nimport { InfoNotice } from '@trise/ui';` + source.slice(insertAt);
  }
  fs.writeFileSync(file, source);
  transformed += replacements.length;
  console.log(`${file}: ${replacements.length}`);
}
console.log(`Converted ${transformed} informational notices.`);
