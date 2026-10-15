/** Validate development endpoints before any browser or API request is made. */
export function localDevelopmentUrl(raw: string): URL {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Browser verification requires an HTTP(S) loopback endpoint');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Development endpoint must not contain credentials, query parameters or fragments');
  }
  return url;
}
