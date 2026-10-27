import { describe, expect, it } from 'vitest';
import { normalizePincodeScope, readPincodeCsvChoices } from './pincode-csv';

function chunkedCsvStream(value: string, chunkSize = 7) {
  const bytes = new TextEncoder().encode(value);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let index = 0; index < bytes.length; index += chunkSize) controller.enqueue(bytes.slice(index, index + chunkSize));
      controller.close();
    },
  });
}

describe('PIN CSV import choices', () => {
  it('extracts exact state, district, and city labels by hierarchy across quoted chunk boundaries', async () => {
    const csv = '\uFEFFpincode,officename,districtname,statename,City Name\r\n'
      + '560001,"Head, ""Central"" Office",Bengaluru Urban,Karnataka,Bengaluru\r\n'
      + '560002,Office,Bengaluru Urban,Karnataka,Whitefield\r\n'
      + '500001,Office,Hyderabad, Telangana ,Hyderabad\r\n'
      + '560003,Office,Bengaluru Urban,Karnataka,Bengaluru\r\n';

    await expect(readPincodeCsvChoices(chunkedCsvStream(csv))).resolves.toEqual({
      states: ['Karnataka', 'Telangana'],
      districtsByState: {
        karnataka: ['Bengaluru Urban'],
        telangana: ['Hyderabad'],
      },
      citiesByStateDistrict: {
        karnataka: { 'bengaluru urban': ['Bengaluru', 'Whitefield'] },
        telangana: { hyderabad: ['Hyderabad'] },
      },
      hasCityColumn: true,
    });
  });

  it('keeps district/state scope available when the CSV has no canonical city column', async () => {
    await expect(readPincodeCsvChoices(chunkedCsvStream('pincode,officename,districtname,statename\n560001,Office,Bangalore,Karnataka\n')))
      .resolves.toMatchObject({ states: ['Karnataka'], districtsByState: { karnataka: ['Bangalore'] }, hasCityColumn: false });
  });

  it('rejects a CSV without district and state fields', async () => {
    await expect(readPincodeCsvChoices(chunkedCsvStream('pincode,officename\n560001,Office\n')))
      .rejects.toThrow('This CSV needs State and District columns');
  });

  it('normalizes state and district names for dependent filtering', () => {
    expect(normalizePincodeScope('  Karnataka  ')).toBe('karnataka');
    expect(normalizePincodeScope('Bengaluru   Urban')).toBe('bengaluru urban');
  });
});
