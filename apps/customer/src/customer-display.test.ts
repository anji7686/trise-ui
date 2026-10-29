import { describe, expect, it } from 'vitest';
import { customerVisibleAddressLines, customerVisibleAddressText } from './customer-display';

describe('customer address display', () => {
  it('removes duplicate Bengaluru and Bangalore locality values while preserving address details', () => {
    expect(customerVisibleAddressText(['Mundur B.O, Bengaluru, Bangalore, Karnataka, 560049, India']))
      .toBe('Mundur B.O, Bengaluru, Karnataka, 560049, India');
  });

  it('deduplicates city aliases across address lines without removing distinct locations', () => {
    expect(customerVisibleAddressLines(['Mundur B.O, Bengaluru', 'Bangalore, Karnataka', 'Mysuru']))
      .toEqual(['Mundur B.O, Bengaluru', 'Karnataka', 'Mysuru']);
  });

  it('keeps distinct address components and filters known synthetic lines', () => {
    expect(customerVisibleAddressLines(['12 MG Road, Indiranagar', 'Continuous browser test address', 'Bengaluru']))
      .toEqual(['12 MG Road, Indiranagar', 'Bengaluru']);
  });
});
