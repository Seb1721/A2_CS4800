export type ReportServiceRecord = {
  carId: number;
  carName: string;
  cost: number | null;
  date: Date;
  description: string;
  mileage: number;
  notes: string;
  serviceId: number;
  serviceType: string;
};

export type ReportServiceRow = Omit<ReportServiceRecord, "date"> & {
  date: string;
};

export type ReportCategorySummary = {
  category: string;
  count: number;
  totalCost: number;
};

export type ReportSummaryCore = {
  averageServiceCost: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  highestCostService: ReportServiceRow | null;
  selectedCarId: number | null;
  serviceCount: number;
  services: ReportServiceRow[];
  servicesByCategory: ReportCategorySummary[];
  totalExpenses: number;
  vehiclesInScope: number;
};

export function summarizeReportServices(input: {
  dateFrom?: string | null;
  dateTo?: string | null;
  selectedCarId?: number | null;
  services: ReportServiceRecord[];
  vehiclesInScope: number;
}): ReportSummaryCore {
  const startDate = parseReportDateInput(input.dateFrom);
  const endDate = parseReportDateInput(input.dateTo, true);

  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    throw new Error("Report start date must be before the end date.");
  }

  const filteredServices = input.services
    .filter((service) => matchesReportRange(service.date, startDate, endDate))
    .sort((left, right) => right.date.getTime() - left.date.getTime());
  const knownCosts = filteredServices
    .map((service) => service.cost)
    .filter((cost): cost is number => cost !== null);
  const formattedServices = filteredServices.map((service) => ({
    ...service,
    date: formatMmDdYyUtc(service.date)
  }));
  const highestCostService =
    formattedServices
      .filter((service) => service.cost !== null)
      .sort((left, right) => (right.cost ?? 0) - (left.cost ?? 0))[0] ?? null;

  return {
    averageServiceCost: knownCosts.length
      ? roundCurrency(knownCosts.reduce((sum, cost) => sum + cost, 0) / knownCosts.length)
      : null,
    dateFrom: input.dateFrom ?? null,
    dateTo: input.dateTo ?? null,
    highestCostService,
    selectedCarId: input.selectedCarId ?? null,
    serviceCount: formattedServices.length,
    services: formattedServices,
    servicesByCategory: buildExpenseByCategory(filteredServices),
    totalExpenses: roundCurrency(knownCosts.reduce((sum, cost) => sum + cost, 0)),
    vehiclesInScope: input.vehiclesInScope
  };
}

export function buildReportCsv(summary: Pick<ReportSummaryCore, "services">) {
  const header = [
    "carId",
    "carName",
    "serviceId",
    "date",
    "serviceType",
    "mileage",
    "cost",
    "description",
    "notes"
  ];
  const rows = summary.services.map((service) => [
    service.carId,
    service.carName,
    service.serviceId,
    service.date,
    service.serviceType,
    service.mileage,
    service.cost ?? "",
    service.description,
    service.notes
  ]);

  return [header, ...rows].map((row) => row.map(toCsvCell).join(",")).join("\n");
}

export function parseReportDateInput(value?: string | null, endOfDay = false) {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error("Report dates must be in yyyy-mm-dd format.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = endOfDay
    ? new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
    : new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Report dates must be in yyyy-mm-dd format.");
  }

  return date;
}

export function matchesReportRange(date: Date, startDate: Date | null, endDate: Date | null) {
  if (startDate && date.getTime() < startDate.getTime()) {
    return false;
  }

  if (endDate && date.getTime() > endDate.getTime()) {
    return false;
  }

  return true;
}

function buildExpenseByCategory(serviceHistory: Array<Pick<ReportServiceRecord, "cost" | "serviceType">>) {
  const categoryMap = new Map<string, { count: number; totalCost: number }>();

  for (const service of serviceHistory) {
    const current = categoryMap.get(service.serviceType) ?? { count: 0, totalCost: 0 };
    categoryMap.set(service.serviceType, {
      count: current.count + 1,
      totalCost: roundCurrency(current.totalCost + (service.cost ?? 0))
    });
  }

  return [...categoryMap.entries()]
    .map(([category, summary]) => ({
      category,
      count: summary.count,
      totalCost: summary.totalCost
    }))
    .sort((left, right) => right.totalCost - left.totalCost || right.count - left.count);
}

function formatMmDdYyUtc(date: Date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function toCsvCell(value: string | number) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}
