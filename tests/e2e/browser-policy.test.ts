import { describe, expect, it } from 'vitest';
import { localDevelopmentUrl } from './browser-policy';

describe('local browser endpoint policy', () => {
  it.each(['http://localhost:4321', 'http://127.0.0.1:5321/api/v1', 'http://[::1]:6321', 'https://localhost:7321'])('allows explicit loopback endpoint %s', url => {
    expect(localDevelopmentUrl(url).href).toBe(new URL(url).href);
  });
  it.each(['https://production.example', 'http://localhost.example', 'http://127.0.0.1.example', 'http://192.168.1.1', 'http://0.0.0.0', 'file://localhost/private', 'ftp://127.0.0.1', 'http://user:secret@localhost', 'http://localhost?token=secret', 'http://localhost#token', 'not-a-url'])('rejects unsafe endpoint %s', url => {
    expect(() => localDevelopmentUrl(url)).toThrow();
  });
});
