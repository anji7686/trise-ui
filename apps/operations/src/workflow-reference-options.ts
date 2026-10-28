export const WORK_SOURCE_OPTIONS = [
  { value: "MARKETING", label: "Marketing" },
  { value: "PROVIDER_DIRECT", label: "Provider Direct" },
  { value: "REFERRAL", label: "Referral" },
  { value: "EXISTING_ASSET", label: "Existing Asset" },
  { value: "AMC_RENEWAL", label: "AMC Renewal" },
  { value: "INTERNAL_REQUEST", label: "Internal Request" },
  { value: "PARTNER", label: "Partner" },
] as const;

export function workSourceLabel(value: string) {
  return (
    WORK_SOURCE_OPTIONS.find((option) => option.value === value)?.label ||
    value
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}
