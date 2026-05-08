export const DEFAULT_SERVICE_INTERVAL_MILES = 5000;
export const DEFAULT_SERVICE_INTERVAL_DAYS = 180;

export type ServiceEntryLike = {
  cost: number | null;
  date: Date;
  mileage: number;
  serviceType: string;
};

export type MileageEntryLike = {
  date: Date;
  mileage: number;
};

export type TrendFilters = {
  dateFrom?: Date | null;
  dateTo?: Date | null;
  serviceType?: string | null;
};

export type TrendPoint = {
  label: string;
  value: number;
};

export type CategoryExpenseItem = {
  category: string;
  count: number;
  totalCost: number;
};

export type ReminderStatus = {
  daysUntilDue: number | null;
  isOverdue?: boolean;
  milesUntilDue: number | null;
  needsAttention: boolean;
  nextServiceMileage: number | null;
  reason: string | null;
};

export type ReminderRule = {
  intervalDays: number;
  intervalMiles: number;
  serviceType: string;
};

export type CategoryReminderStatus = ReminderStatus & {
  intervalDays: number;
  intervalMiles: number;
  latestServiceDate: Date | null;
  latestServiceMileage: number | null;
  serviceType: string;
};

export type FleetVehicleLike = {
  carId: number;
  carName: string;
  currentMileage: number;
  lifetimeExpenses: number;
  serviceCount: number;
};

export type FleetHighlights = {
  highestMileageVehicle: FleetVehicleLike | null;
  highestSpendVehicle: FleetVehicleLike | null;
  mostServicedVehicle: FleetVehicleLike | null;
  vehicleCount: number;
};

export function buildExpenseTrend(serviceHistory: ServiceEntryLike[]): TrendPoint[] {
  const trendMap = new Map<string, { label: string; value: number }>();

  for (const service of serviceHistory) {
    if (service.cost === null) {
      continue;
    }

    const bucket = getMonthBucket(service.date);
    const current = trendMap.get(bucket.sortKey);
    trendMap.set(bucket.sortKey, {
      label: bucket.label,
      value: roundCurrency((current?.value ?? 0) + service.cost)
    });
  }

  return [...trendMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-6)
    .map(([, value]) => value);
}

export function buildMileageTrend(mileageHistory: MileageEntryLike[]): TrendPoint[] {
  const trendMap = new Map<string, { label: string; value: number }>();

  for (const entry of mileageHistory) {
    const bucket = getMonthBucket(entry.date);
    const current = trendMap.get(bucket.sortKey);
    trendMap.set(bucket.sortKey, {
      label: bucket.label,
      value: Math.max(current?.value ?? 0, entry.mileage)
    });
  }

  return [...trendMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-6)
    .map(([, value]) => value);
}

export function buildExpenseByCategory(serviceHistory: ServiceEntryLike[]): CategoryExpenseItem[] {
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

export function filterServiceHistoryByTrend(
  serviceHistory: ServiceEntryLike[],
  filters: TrendFilters = {}
) {
  return serviceHistory.filter((service) => {
    if (filters.serviceType && service.serviceType !== filters.serviceType) {
      return false;
    }

    if (filters.dateFrom && service.date.getTime() < filters.dateFrom.getTime()) {
      return false;
    }

    if (filters.dateTo && service.date.getTime() > filters.dateTo.getTime()) {
      return false;
    }

    return true;
  });
}

export function filterMileageHistoryByTrend(
  mileageHistory: MileageEntryLike[],
  filters: Pick<TrendFilters, "dateFrom" | "dateTo"> = {}
) {
  return mileageHistory.filter((entry) => {
    if (filters.dateFrom && entry.date.getTime() < filters.dateFrom.getTime()) {
      return false;
    }

    if (filters.dateTo && entry.date.getTime() > filters.dateTo.getTime()) {
      return false;
    }

    return true;
  });
}

export function calculateMilesDriven(mileageHistory: MileageEntryLike[]) {
  if (mileageHistory.length < 2) {
    return null;
  }

  const sorted = [...mileageHistory].sort((left, right) => left.date.getTime() - right.date.getTime());
  return Math.max(0, sorted[sorted.length - 1].mileage - sorted[0].mileage);
}

export function calculateAverageMonthlyMileage(mileageHistory: MileageEntryLike[]) {
  const milesDriven = calculateMilesDriven(mileageHistory);
  if (milesDriven === null) {
    return null;
  }

  const sorted = [...mileageHistory].sort((left, right) => left.date.getTime() - right.date.getTime());
  return Math.round(milesDriven / countInclusiveMonths(sorted[0].date, sorted[sorted.length - 1].date));
}

export function calculateAverageMonthlyExpense(serviceHistory: ServiceEntryLike[]) {
  const pricedServices = serviceHistory.filter((service) => service.cost !== null);
  if (pricedServices.length === 0) {
    return null;
  }

  const sorted = [...pricedServices].sort((left, right) => left.date.getTime() - right.date.getTime());
  const total = pricedServices.reduce((sum, service) => sum + (service.cost ?? 0), 0);
  return roundCurrency(total / countInclusiveMonths(sorted[0].date, sorted[sorted.length - 1].date));
}

export function calculateAverageMonthlyServiceFrequency(serviceHistory: ServiceEntryLike[]) {
  if (serviceHistory.length === 0) {
    return null;
  }

  const sorted = [...serviceHistory].sort((left, right) => left.date.getTime() - right.date.getTime());
  return roundCurrency(serviceHistory.length / countInclusiveMonths(sorted[0].date, sorted[sorted.length - 1].date));
}

export function calculateReminderStatus(input: {
  currentMileage: number;
  currentDate?: Date;
  latestService: { date: Date; mileage: number } | null;
  serviceLabel?: string;
  serviceIntervalDays?: number;
  serviceIntervalMiles?: number;
}): ReminderStatus {
  const currentDate = input.currentDate ?? new Date();
  const serviceIntervalMiles = input.serviceIntervalMiles ?? DEFAULT_SERVICE_INTERVAL_MILES;
  const serviceIntervalDays = input.serviceIntervalDays ?? DEFAULT_SERVICE_INTERVAL_DAYS;
  const serviceLabel = input.serviceLabel ?? "Service";

  if (!input.latestService) {
    return {
      daysUntilDue: null,
      isOverdue: false,
      milesUntilDue: null,
      needsAttention: true,
      nextServiceMileage: null,
      reason:
        input.serviceLabel === undefined
          ? "No service history recorded yet."
          : `No ${serviceLabel} history recorded yet.`
    };
  }

  const milesSinceLastService = Math.max(0, input.currentMileage - input.latestService.mileage);
  const daysSinceLastService = daysBetween(input.latestService.date, currentDate);
  const milesUntilDue = serviceIntervalMiles - milesSinceLastService;
  const daysUntilDue = serviceIntervalDays - daysSinceLastService;
  const nextServiceMileage = input.latestService.mileage + serviceIntervalMiles;

  if (milesUntilDue <= 0) {
    return {
      daysUntilDue,
      isOverdue: true,
      milesUntilDue: 0,
      needsAttention: true,
      nextServiceMileage,
      reason:
        input.serviceLabel === undefined
          ? `${Math.abs(milesUntilDue).toLocaleString("en-US")} miles overdue for service.`
          : `${serviceLabel} overdue by ${Math.abs(milesUntilDue).toLocaleString("en-US")} miles.`
    };
  }

  if (daysUntilDue <= 0) {
    return {
      daysUntilDue: 0,
      isOverdue: true,
      milesUntilDue,
      needsAttention: true,
      nextServiceMileage,
      reason:
        input.serviceLabel === undefined
          ? `${Math.abs(daysUntilDue)} days overdue for service.`
          : `${serviceLabel} overdue by ${Math.abs(daysUntilDue)} days.`
    };
  }

  if (milesUntilDue <= 500 || daysUntilDue <= 30) {
    return {
      daysUntilDue,
      isOverdue: false,
      milesUntilDue,
      needsAttention: true,
      nextServiceMileage,
      reason:
        milesUntilDue <= 500
          ? input.serviceLabel === undefined
            ? `Service due in ${milesUntilDue.toLocaleString("en-US")} miles.`
            : `${serviceLabel} due in ${milesUntilDue.toLocaleString("en-US")} miles.`
          : input.serviceLabel === undefined
            ? `Service due in ${daysUntilDue} days.`
            : `${serviceLabel} due in ${daysUntilDue} days.`
    };
  }

  return {
    daysUntilDue,
    isOverdue: false,
    milesUntilDue,
    needsAttention: false,
    nextServiceMileage,
    reason: null
  };
}

export function isOverdueReminder(status: ReminderStatus) {
  return status.isOverdue ?? (status.reason !== null && status.reason.includes("overdue"));
}

export function canManageMileageEntry(source: string) {
  return source === "manual" || source === "correction";
}

export function getFleetHighlights(vehicles: FleetVehicleLike[]): FleetHighlights {
  return {
    highestMileageVehicle: pickTopVehicle(vehicles, (vehicle) => vehicle.currentMileage),
    highestSpendVehicle: pickTopVehicle(vehicles, (vehicle) => vehicle.lifetimeExpenses),
    mostServicedVehicle: pickTopVehicle(vehicles, (vehicle) => vehicle.serviceCount),
    vehicleCount: vehicles.length
  };
}

export function calculateCategoryReminderStatuses(input: {
  currentDate?: Date;
  currentMileage: number;
  rules: ReminderRule[];
  serviceHistory: ServiceEntryLike[];
}): CategoryReminderStatus[] {
  const currentDate = input.currentDate ?? new Date();

  return input.rules
    .map((rule) => {
      const latestService = getLatestServiceForType(input.serviceHistory, rule.serviceType);
      const status = calculateReminderStatus({
        currentDate,
        currentMileage: input.currentMileage,
        latestService,
        serviceIntervalDays: rule.intervalDays,
        serviceIntervalMiles: rule.intervalMiles,
        serviceLabel: rule.serviceType
      });

      return {
        ...status,
        intervalDays: rule.intervalDays,
        intervalMiles: rule.intervalMiles,
        latestServiceDate: latestService?.date ?? null,
        latestServiceMileage: latestService?.mileage ?? null,
        serviceType: rule.serviceType
      };
    })
    .sort(compareReminderStatuses);
}

export function pickPrimaryReminderStatus(statuses: CategoryReminderStatus[]): ReminderStatus {
  const primary = statuses[0];

  if (!primary) {
    return {
      daysUntilDue: null,
      isOverdue: false,
      milesUntilDue: null,
      needsAttention: false,
      nextServiceMileage: null,
      reason: null
    };
  }

  return {
    daysUntilDue: primary.daysUntilDue,
    isOverdue: primary.isOverdue,
    milesUntilDue: primary.milesUntilDue,
    needsAttention: primary.needsAttention,
    nextServiceMileage: primary.nextServiceMileage,
    reason: primary.reason
  };
}

export function daysBetween(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getMonthBucket(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  return {
    label: date.toLocaleString("en-US", {
      month: "short",
      timeZone: "UTC",
      year: "numeric"
    }),
    sortKey: `${year}-${String(month).padStart(2, "0")}`
  };
}

function countInclusiveMonths(start: Date, end: Date) {
  const yearDelta = end.getUTCFullYear() - start.getUTCFullYear();
  const monthDelta = end.getUTCMonth() - start.getUTCMonth();
  return Math.max(1, yearDelta * 12 + monthDelta + 1);
}

function pickTopVehicle(vehicles: FleetVehicleLike[], selector: (vehicle: FleetVehicleLike) => number) {
  if (vehicles.length === 0) {
    return null;
  }

  return [...vehicles].sort((left, right) => selector(right) - selector(left))[0];
}

function getLatestServiceForType(serviceHistory: ServiceEntryLike[], serviceType: string) {
  const matchingServices = serviceHistory.filter((service) => service.serviceType === serviceType);

  if (matchingServices.length === 0) {
    return null;
  }

  return [...matchingServices].sort((left, right) => right.date.getTime() - left.date.getTime())[0];
}

function compareReminderStatuses(left: CategoryReminderStatus, right: CategoryReminderStatus) {
  const severity = scoreReminderSeverity(right) - scoreReminderSeverity(left);
  if (severity !== 0) {
    return severity;
  }

  const leftMiles = left.milesUntilDue ?? Number.POSITIVE_INFINITY;
  const rightMiles = right.milesUntilDue ?? Number.POSITIVE_INFINITY;
  if (leftMiles !== rightMiles) {
    return leftMiles - rightMiles;
  }

  const leftDays = left.daysUntilDue ?? Number.POSITIVE_INFINITY;
  const rightDays = right.daysUntilDue ?? Number.POSITIVE_INFINITY;
  if (leftDays !== rightDays) {
    return leftDays - rightDays;
  }

  return left.serviceType.localeCompare(right.serviceType);
}

function scoreReminderSeverity(status: CategoryReminderStatus) {
  if (status.isOverdue) {
    return 3;
  }

  if (status.needsAttention) {
    return 2;
  }

  return 1;
}
