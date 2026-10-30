export const quotationPurposeLabels: Record<string, string> = {
  SERVICE: "Service quotation",
  REPAIR: "Repair quotation",
  PARTS: "Parts supply",
  INSTALLATION: "New installation",
  MODIFICATION: "Modification",
  TAKEOVER: "Takeover",
  NEW_ASSET: "New asset",
  PROCUREMENT: "Procurement",
  MAINTENANCE_CONTRACT: "New AMC quotation",
  CONTRACT_RENEWAL: "AMC renewal quotation",
  OTHER_CONTROLLED: "Other controlled work",
};

export const supportedQuotationPurposes = Object.keys(quotationPurposeLabels);

export const quotationCreationLabels: Record<string, string> = {
  ...quotationPurposeLabels,
  SERVICE: "Service",
  REPAIR: "Repair",
  MAINTENANCE_CONTRACT: "New AMC",
  CONTRACT_RENEWAL: "AMC renewal",
};

export const quotationDefaultDescriptions: Record<string, string> = {
  INSTALLATION: "Elevator installation",
  MODIFICATION: "Elevator modification",
  TAKEOVER: "Elevator maintenance takeover",
  SERVICE: "Elevator service work",
  REPAIR: "Elevator repair work",
  PARTS: "Elevator parts supply",
  PROCUREMENT: "Elevator procurement",
  NEW_ASSET: "New elevator asset",
  OTHER_CONTROLLED: "Controlled elevator work",
  MAINTENANCE_CONTRACT: "Paid AMC coverage",
  CONTRACT_RENEWAL: "AMC renewal",
};
