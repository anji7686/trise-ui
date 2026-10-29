export function canSubmitCustomerRequest(step: number, finalStep: number): boolean {
  return step === finalStep;
}

export function customerRequestTypeLabel(value: string): string {
  switch (value.trim().toUpperCase()) {
    case 'REPAIR': return 'Repair or not working';
    case 'PREVENTIVE': return 'Preventive service';
    case 'UNUSUAL_NOISE': return 'Unusual noise';
    case 'INSPECTION': return 'Inspection';
    case 'CALLBACK': return 'Callback';
    case 'OTHER': return 'Other';
    default: return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
