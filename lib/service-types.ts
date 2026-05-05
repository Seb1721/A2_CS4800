export const COMMON_SERVICE_TYPES = [
  "Oil Change",
  "Tire Service",
  "Brake Service",
  "Battery",
  "Fluids",
  "Inspection",
  "Repair",
  "Other"
] as const;

export type CommonServiceType = (typeof COMMON_SERVICE_TYPES)[number];
