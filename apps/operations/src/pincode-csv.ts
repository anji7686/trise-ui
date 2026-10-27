const HEADER_ALIASES = {
  city: ['city', 'cityname', 'city_name', 'town', 'townname', 'town_name'],
  district: ['district', 'districtname', 'district_name'],
  state: ['state', 'statename', 'state_name'],
} as const;

export type PincodeCsvChoices = {
  states: string[];
  districtsByState: Record<string, string[]>;
  citiesByStateDistrict: Record<string, Record<string, string[]>>;
  hasCityColumn: boolean;
};

export function normalizePincodeScope(value: string) {
  return value.trim().toLocaleLowerCase('en-IN').replace(/\s+/g, ' ');
}

function normalizeHeader(value: string) {
  return value.toLocaleLowerCase('en-IN').replace(/[^a-z0-9]/g, '');
}

const STATE_HEADERS = new Set(HEADER_ALIASES.state.map(normalizeHeader));
const DISTRICT_HEADERS = new Set(HEADER_ALIASES.district.map(normalizeHeader));
const CITY_HEADERS = new Set(HEADER_ALIASES.city.map(normalizeHeader));

/** Extract selectable labels from a CSV incrementally without buffering the file. */
export async function readPincodeCsvChoices(
  stream: ReadableStream<Uint8Array>,
  isCurrent: () => boolean = () => true,
): Promise<PincodeCsvChoices> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  const states = new Set<string>();
  const districts = new Map<string, Set<string>>();
  const cities = new Map<string, Map<string, Set<string>>>();
  let headers: string[] | null = null;
  let stateIndex = -1;
  let districtIndex = -1;
  let cityIndex = -1;
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let quotePending = false;
  let skipLineFeed = false;

  const finishRow = () => {
    row.push(field);
    field = '';
    if (!headers) {
      headers = row.map((value, index) => normalizeHeader(index === 0 ? value.replace(/^\uFEFF/, '') : value));
      stateIndex = headers.findIndex((header) => STATE_HEADERS.has(header));
      districtIndex = headers.findIndex((header) => DISTRICT_HEADERS.has(header));
      cityIndex = headers.findIndex((header) => CITY_HEADERS.has(header));
      if (stateIndex < 0 || districtIndex < 0) throw new Error('This CSV needs State and District columns to choose an import scope.');
    } else if (row.some((value) => value.trim())) {
      const state = row[stateIndex]?.trim() || '';
      const district = row[districtIndex]?.trim() || '';
      const city = cityIndex < 0 ? '' : row[cityIndex]?.trim() || '';
      const stateKey = normalizePincodeScope(state);
      const districtKey = normalizePincodeScope(district);
      if (stateKey && districtKey) {
        states.add(state);
        const districtNames = districts.get(stateKey) || new Set<string>();
        districtNames.add(district);
        districts.set(stateKey, districtNames);
        if (city) {
          const byDistrict = cities.get(stateKey) || new Map<string, Set<string>>();
          const cityNames = byDistrict.get(districtKey) || new Set<string>();
          cityNames.add(city);
          byDistrict.set(districtKey, cityNames);
          cities.set(stateKey, byDistrict);
        }
      }
    }
    row = [];
  };

  const processText = (text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (inQuotes) {
        if (quotePending) {
          quotePending = false;
          if (character === '"') { field += '"'; continue; }
          inQuotes = false;
        } else if (character === '"') {
          quotePending = true;
          continue;
        } else {
          field += character;
          continue;
        }
      }

      if (skipLineFeed) {
        skipLineFeed = false;
        if (character === '\n') continue;
      }
      if (character === '"' && field.length === 0) inQuotes = true;
      else if (character === ',') { row.push(field); field = ''; }
      else if (character === '\r' || character === '\n') {
        finishRow();
        skipLineFeed = character === '\r';
      } else field += character;
    }
  };

  try {
    while (isCurrent()) {
      const { value, done } = await reader.read();
      if (done) break;
      processText(decoder.decode(value, { stream: true }));
    }
    if (!isCurrent()) return { states: [], districtsByState: {}, citiesByStateDistrict: {}, hasCityColumn: false };
    processText(decoder.decode());
    if (quotePending) { quotePending = false; inQuotes = false; }
    if (inQuotes) throw new Error('This CSV has an unclosed quoted field.');
    if (field.length || row.length) finishRow();
    if (!headers) throw new Error('This CSV is empty.');
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }

  return {
    states: [...states].sort((a, b) => a.localeCompare(b, 'en-IN', { sensitivity: 'base' })),
    districtsByState: Object.fromEntries([...districts].map(([state, names]) => [state, [...names].sort((a, b) => a.localeCompare(b, 'en-IN', { sensitivity: 'base' }))])),
    citiesByStateDistrict: Object.fromEntries([...cities].map(([state, byDistrict]) => [state, Object.fromEntries([...byDistrict].map(([district, names]) => [district, [...names].sort((a, b) => a.localeCompare(b, 'en-IN', { sensitivity: 'base' }))]))])),
    hasCityColumn: cityIndex >= 0,
  };
}
