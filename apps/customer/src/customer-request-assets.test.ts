import { describe, expect, it } from 'vitest';
import { customerRequestAssetContext } from './customer-request-assets';

describe('customer request asset context', () => {
  it('shows the linked place and human-readable asset code', () => {
    expect(customerRequestAssetContext('Maple Heights', 'AST-0084')).toBe('Maple Heights · AST-0084');
  });

  it('uses plain missing-data labels instead of exposing a generated resource ID', () => {
    expect(customerRequestAssetContext('Maple Heights', null)).toBe('Maple Heights · Asset code not supplied');
    expect(customerRequestAssetContext(null, null)).toBe('Service location not supplied · Asset code not supplied');
  });

  it('shows the account qualifier when duplicate provider relationships need to be distinguished', () => {
    expect(customerRequestAssetContext('Maple Heights', null, 'Account 2', 'ABC2345')).toBe('Account 2 · Site code ABC2345 · Maple Heights · Asset code not supplied');
  });
});
