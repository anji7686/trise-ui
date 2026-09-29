import { describe, expect, it } from 'vitest';
import { translate } from './index';

describe('localization foundation', () => {
  it('uses Kannada resources when selected and English fallback for unknown keys', () => {
    expect(translate('kn', 'assets')).toBe('ಸ್ವತ್ತುಗಳು');
    expect(translate('kn', 'missing')).toBe('missing');
  });
});
