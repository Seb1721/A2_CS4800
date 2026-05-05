import {
  buildExpenseByCategory,
  buildExpenseTrend,
  buildMileageTrend,
  canManageMileageEntry,
  calculateCategoryReminderStatuses,
  calculateReminderStatus,
  DEFAULT_SERVICE_INTERVAL_DAYS,
  DEFAULT_SERVICE_INTERVAL_MILES,
  daysBetween,
  isOverdueReminder,
  pickPrimaryReminderStatus,
  roundCurrency
} from "@/lib/car-insights";
import { getDatabase } from "@/lib/mongodb";
import { summarizeReportServices } from "@/lib/reporting-core";
import { COMMON_SERVICE_TYPES } from "@/lib/service-types";
import type {
  AttentionItem,
  CarDetails,
  CarSummary,
  DashboardOverview,
  DashboardRecentService,
  MileageHistoryItem,
  ReportSummary,
  ServiceReminderRule,
  ServiceHistoryItem
} from "@/lib/types";

export { buildReportCsv } from "@/lib/reporting-core";

type ServiceEntry = {
  serviceId: number;
  date: Date;
  mileage: number;
  serviceType: string;
  description: string;
  notes: string;
  cost: number | null;
};

type MileageEntry = {
  entryId: number;
  date: Date;
  mileage: number;
  source: string;
  serviceId?: number;
  notes: string;
};

type ReminderRuleDocument = ServiceReminderRule;

type CarDocument = {
  carId: number;
  ownerUsername: string;
  make: string;
  model: string;
  year: number;
  currentMileage: number;
  lastServiceDate: Date | null;
  serviceIntervalDays?: number;
  serviceIntervalMiles?: number;
  serviceReminderRules?: ReminderRuleDocument[];
  serviceHistory: ServiceEntry[];
  mileageHistory?: MileageEntry[];
  serviceCount: number;
  lifetimeCost: number;
  imageUrl: string;
  createdAt: Date;
  updatedAt?: Date;
};

type CreateCarInput = {
  make: string;
  model: string;
  year: number;
  mileage: number;
  imageUrl: string;
  serviceReminderRules: ReminderRuleDocument[];
};

type UpdateCarInput = {
  make: string;
  model: string;
  year: number;
  mileage: number;
  imageUrl: string;
  serviceReminderRules: ReminderRuleDocument[];
  allowMileageCorrection: boolean;
};

type UpdateMileageInput = {
  carId: number;
  mileage: number;
  date: string;
  notes: string;
  allowCorrection: boolean;
};

type UpdateMileageEntryInput = {
  mileage: number;
  date: string;
  notes: string;
  allowCorrection: boolean;
};

type AddServiceInput = {
  carId: number;
  serviceDate: string;
  mileage: number;
  serviceType: string;
  description: string;
  notes: string;
  cost: unknown;
};

type UpdateServiceInput = AddServiceInput;

type ReportFilters = {
  carId?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
};

export async function listCarsForUser(username: string): Promise<CarSummary[]> {
  const db = await getDatabase();
  const cars = db.collection<CarDocument>("cars");
  const records = await cars.find({ ownerUsername: username }).sort({ carId: 1 }).toArray();
  return records.map(toCarSummary);
}

export async function getCarDetailsForUser(username: string, carId: number): Promise<CarDetails> {
  const car = await findCarForUser(username, carId);
  return toCarDetails(car);
}

export async function createCar(username: string, input: CreateCarInput): Promise<CarDetails> {
  const db = await getDatabase();
  const cars = db.collection<CarDocument>("cars");
  const { imageUrl, make, mileage, serviceReminderRules, model, year } = validateVehicleFields(input);
  const [carId, entryId] = await Promise.all([nextSequence("cars"), nextSequence("mileageEntries")]);
  const now = new Date();
  const primaryRule = getPrimaryServiceRule(serviceReminderRules);

  const record: CarDocument = {
    carId,
    ownerUsername: username,
    make,
    model,
    year,
    currentMileage: mileage,
    lastServiceDate: null,
    serviceIntervalDays: primaryRule?.intervalDays,
    serviceIntervalMiles: primaryRule?.intervalMiles,
    serviceReminderRules,
    serviceHistory: [],
    mileageHistory: [
      {
        entryId,
        date: now,
        mileage,
        source: "initial",
        notes: "Vehicle profile created."
      }
    ],
    serviceCount: 0,
    lifetimeCost: 0,
    imageUrl,
    createdAt: now,
    updatedAt: now
  };

  await cars.insertOne(record);
  return toCarDetails(record);
}

export async function updateCarForUser(
  username: string,
  carId: number,
  input: UpdateCarInput
): Promise<CarDetails> {
  const db = await getDatabase();
  const cars = db.collection<CarDocument>("cars");
  const existing = await findCarForUser(username, carId);
  const { imageUrl, make, mileage, serviceReminderRules, model, year } = validateVehicleFields(input);
  const primaryRule = getPrimaryServiceRule(serviceReminderRules);
  const updates: Partial<CarDocument> = {
    imageUrl,
    make,
    model,
    serviceIntervalDays: primaryRule?.intervalDays,
    serviceIntervalMiles: primaryRule?.intervalMiles,
    serviceReminderRules,
    updatedAt: new Date(),
    year
  };
  let mileageHistory = getMileageHistory(existing);
  let currentMileage = existing.currentMileage;

  if (mileage !== existing.currentMileage) {
    if (mileage < existing.currentMileage && !input.allowMileageCorrection) {
      throw new Error("Mileage cannot decrease unless you confirm it is a correction.");
    }

    const entryId = await nextSequence("mileageEntries");
    const note =
      mileage < existing.currentMileage
        ? "Mileage corrected from vehicle settings."
        : "Mileage updated from vehicle settings.";

    mileageHistory = [
      ...mileageHistory,
      {
        entryId,
        date: new Date(),
        mileage,
        source: mileage < existing.currentMileage ? "correction" : "profile-update",
        notes: note
      }
    ];
    currentMileage = mileage;
    updates.currentMileage = mileage;
    updates.mileageHistory = mileageHistory;
  }

  await cars.updateOne({ ownerUsername: username, carId }, { $set: updates });

  return toCarDetails({
    ...existing,
    ...updates,
    currentMileage,
    imageUrl,
    make,
    mileageHistory,
    model,
    serviceIntervalDays: primaryRule?.intervalDays ?? existing.serviceIntervalDays,
    serviceIntervalMiles: primaryRule?.intervalMiles ?? existing.serviceIntervalMiles,
    serviceReminderRules,
    year
  });
}

export async function deleteCarForUser(username: string, carId: number) {
  const db = await getDatabase();
  const cars = db.collection<CarDocument>("cars");
  const result = await cars.deleteOne({ ownerUsername: username, carId });

  if (!result.deletedCount) {
    throw new Error(`Car id ${carId} not found.`);
  }
}

export async function updateMileageForUser(
  username: string,
  input: UpdateMileageInput
): Promise<CarDetails> {
  if (!Number.isInteger(input.carId) || input.carId <= 0) {
    throw new Error("Enter a valid car ID.");
  }

  if (!Number.isInteger(input.mileage) || input.mileage < 0) {
    throw new Error("Mileage cannot be negative.");
  }

  const db = await getDatabase();
  const cars = db.collection<CarDocument>("cars");
  const car = await findCarForUser(username, input.carId);

  if (input.mileage < car.currentMileage && !input.allowCorrection) {
    throw new Error("Mileage cannot decrease unless you confirm it is a correction.");
  }

  const entryDate = parseIsoDate(input.date);
  const notes = input.notes.trim();
  const entryId = await nextSequence("mileageEntries");
  const mileageEntry: MileageEntry = {
    entryId,
    date: entryDate,
    mileage: input.mileage,
    source: input.mileage < car.currentMileage ? "correction" : "manual",
    notes: notes || "Mileage updated from dashboard."
  };
  const mileageHistory = [...getMileageHistory(car), mileageEntry];
  const updatedCar: CarDocument = {
    ...car,
    currentMileage: input.mileage,
    mileageHistory,
    updatedAt: new Date()
  };

  await cars.updateOne(
    { ownerUsername: username, carId: input.carId },
    {
      $set: {
        currentMileage: input.mileage,
        mileageHistory,
        updatedAt: updatedCar.updatedAt
      }
    }
  );

  return toCarDetails(updatedCar);
}

export async function updateMileageEntryForUser(
  username: string,
  carId: number,
  entryId: number,
  input: UpdateMileageEntryInput
): Promise<CarDetails> {
  if (!Number.isInteger(entryId) || entryId <= 0) {
    throw new Error("Enter a valid mileage entry.");
  }

  if (!Number.isInteger(input.mileage) || input.mileage < 0) {
    throw new Error("Mileage cannot be negative.");
  }

  const db = await getDatabase();
  const cars = db.collection<CarDocument>("cars");
  const car = await findCarForUser(username, carId);
  const mileageHistory = getMileageHistory(car);
  const entryIndex = mileageHistory.findIndex((entry) => entry.entryId === entryId);

  if (entryIndex === -1) {
    throw new Error(`Mileage entry ${entryId} not found.`);
  }

  const existingEntry = mileageHistory[entryIndex];
  if (!canManageMileageEntry(existingEntry.source)) {
    throw new Error("This mileage entry must be updated from its original workflow.");
  }

  const entryDate = parseIsoDate(input.date);
  const notes = input.notes.trim() || "Mileage updated from dashboard.";
  const previousMileage = existingEntry.mileage;
  const isCorrection = input.mileage < previousMileage;

  if (isCorrection && !input.allowCorrection) {
    throw new Error("Mileage cannot decrease unless you confirm it is a correction.");
  }

  const updatedEntry: MileageEntry = {
    ...existingEntry,
    date: entryDate,
    mileage: input.mileage,
    notes,
    source: isCorrection ? "correction" : "manual"
  };
  const updatedHistory = [...mileageHistory];
  updatedHistory[entryIndex] = updatedEntry;
  const updatedCar = recalculateCar({
    ...car,
    mileageHistory: updatedHistory,
    updatedAt: new Date()
  });

  await cars.updateOne(
    { ownerUsername: username, carId },
    {
      $set: {
        currentMileage: updatedCar.currentMileage,
        mileageHistory: updatedCar.mileageHistory,
        updatedAt: updatedCar.updatedAt
      }
    }
  );

  return toCarDetails(updatedCar);
}

export async function deleteMileageEntryForUser(
  username: string,
  carId: number,
  entryId: number
): Promise<CarDetails> {
  if (!Number.isInteger(entryId) || entryId <= 0) {
    throw new Error("Enter a valid mileage entry.");
  }

  const db = await getDatabase();
  const cars = db.collection<CarDocument>("cars");
  const car = await findCarForUser(username, carId);
  const mileageHistory = getMileageHistory(car);
  const entry = mileageHistory.find((item) => item.entryId === entryId);

  if (!entry) {
    throw new Error(`Mileage entry ${entryId} not found.`);
  }

  if (!canManageMileageEntry(entry.source)) {
    throw new Error("This mileage entry must be deleted from its original workflow.");
  }

  const updatedHistory = mileageHistory.filter((item) => item.entryId !== entryId);
  if (updatedHistory.length === 0) {
    throw new Error("A vehicle must keep at least one mileage record.");
  }

  const updatedCar = recalculateCar({
    ...car,
    mileageHistory: updatedHistory,
    updatedAt: new Date()
  });

  await cars.updateOne(
    { ownerUsername: username, carId },
    {
      $set: {
        currentMileage: updatedCar.currentMileage,
        mileageHistory: updatedCar.mileageHistory,
        updatedAt: updatedCar.updatedAt
      }
    }
  );

  return toCarDetails(updatedCar);
}

export async function addServiceToCar(username: string, input: AddServiceInput): Promise<CarDetails> {
  if (!Number.isInteger(input.carId) || input.carId <= 0) {
    throw new Error("Enter a valid car ID.");
  }

  if (!Number.isInteger(input.mileage) || input.mileage < 0) {
    throw new Error("Mileage cannot be negative.");
  }

  const serviceDate = parseMmDdYy(input.serviceDate);
  const serviceType = input.serviceType.trim();
  const description = input.description.trim();
  const notes = input.notes.trim();
  const cost = parseCost(input.cost);

  if (!serviceType) {
    throw new Error("Service date and service type are required.");
  }

  const db = await getDatabase();
  const cars = db.collection<CarDocument>("cars");
  const car = await findCarForUser(username, input.carId);
  const [serviceId, mileageEntryId] = await Promise.all([
    nextSequence("services"),
    nextSequence("mileageEntries")
  ]);

  const serviceEntry: ServiceEntry = {
    serviceId,
    date: serviceDate,
    mileage: input.mileage,
    serviceType,
    description,
    notes,
    cost
  };
  const updatedHistory = [...car.serviceHistory, serviceEntry];
  const updatedMileage = Math.max(car.currentMileage, input.mileage);
  const updatedLifetimeCost = cost === null ? car.lifetimeCost : roundCurrency(car.lifetimeCost + cost);
  const mileageHistory = [
    ...getMileageHistory(car),
    {
      entryId: mileageEntryId,
      date: serviceDate,
      mileage: input.mileage,
      source: "service",
      serviceId,
      notes: `${serviceType} recorded.`
    }
  ];
  const updatedCar = recalculateCar({
    ...car,
    currentMileage: updatedMileage,
    lastServiceDate: serviceDate,
    lifetimeCost: updatedLifetimeCost,
    mileageHistory,
    serviceCount: car.serviceCount + 1,
    serviceHistory: updatedHistory,
    updatedAt: new Date()
  });

  await cars.updateOne(
    { ownerUsername: username, carId: input.carId },
    {
      $set: {
        serviceHistory: updatedHistory,
        lastServiceDate: serviceDate,
        serviceCount: updatedCar.serviceCount,
        currentMileage: updatedMileage,
        lifetimeCost: updatedLifetimeCost,
        mileageHistory,
        updatedAt: updatedCar.updatedAt
      }
    }
  );

  return toCarDetails(updatedCar);
}

export async function updateServiceForCar(
  username: string,
  carId: number,
  serviceId: number,
  input: UpdateServiceInput
): Promise<CarDetails> {
  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    throw new Error("Enter a valid service ID.");
  }

  if (!Number.isInteger(input.carId) || input.carId !== carId) {
    throw new Error("Service update request is missing the correct car ID.");
  }

  if (!Number.isInteger(input.mileage) || input.mileage < 0) {
    throw new Error("Mileage cannot be negative.");
  }

  const serviceDate = parseMmDdYy(input.serviceDate);
  const serviceType = input.serviceType.trim();
  const description = input.description.trim();
  const notes = input.notes.trim();
  const cost = parseCost(input.cost);

  if (!serviceType) {
    throw new Error("Service date and service type are required.");
  }

  const db = await getDatabase();
  const cars = db.collection<CarDocument>("cars");
  const car = await findCarForUser(username, carId);
  const serviceIndex = car.serviceHistory.findIndex((service) => service.serviceId === serviceId);

  if (serviceIndex === -1) {
    throw new Error(`Service id ${serviceId} not found.`);
  }

  const updatedService: ServiceEntry = {
    serviceId,
    date: serviceDate,
    mileage: input.mileage,
    serviceType,
    description,
    notes,
    cost
  };
  const updatedHistory = [...car.serviceHistory];
  updatedHistory[serviceIndex] = updatedService;
  const mileageHistory = getMileageHistory(car).map((entry) =>
    entry.serviceId === serviceId
      ? {
          ...entry,
          date: serviceDate,
          mileage: input.mileage,
          notes: `${serviceType} recorded.`,
          source: "service"
        }
      : entry
  );
  const updatedCar = recalculateCar({
    ...car,
    mileageHistory,
    serviceHistory: updatedHistory,
    updatedAt: new Date()
  });

  await cars.updateOne(
    { ownerUsername: username, carId },
    {
      $set: {
        currentMileage: updatedCar.currentMileage,
        lastServiceDate: updatedCar.lastServiceDate,
        lifetimeCost: updatedCar.lifetimeCost,
        mileageHistory: updatedCar.mileageHistory,
        serviceCount: updatedCar.serviceCount,
        serviceHistory: updatedHistory,
        updatedAt: updatedCar.updatedAt
      }
    }
  );

  return toCarDetails(updatedCar);
}

export async function deleteServiceForCar(username: string, carId: number, serviceId: number): Promise<CarDetails> {
  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    throw new Error("Enter a valid service ID.");
  }

  const db = await getDatabase();
  const cars = db.collection<CarDocument>("cars");
  const car = await findCarForUser(username, carId);
  const filteredServices = car.serviceHistory.filter((service) => service.serviceId !== serviceId);

  if (filteredServices.length === car.serviceHistory.length) {
    throw new Error(`Service id ${serviceId} not found.`);
  }

  const mileageHistory = getMileageHistory(car).filter((entry) => entry.serviceId !== serviceId);
  const updatedCar = recalculateCar({
    ...car,
    mileageHistory,
    serviceHistory: filteredServices,
    updatedAt: new Date()
  });

  await cars.updateOne(
    { ownerUsername: username, carId },
    {
      $set: {
        currentMileage: updatedCar.currentMileage,
        lastServiceDate: updatedCar.lastServiceDate,
        lifetimeCost: updatedCar.lifetimeCost,
        mileageHistory: updatedCar.mileageHistory,
        serviceCount: updatedCar.serviceCount,
        serviceHistory: filteredServices,
        updatedAt: updatedCar.updatedAt
      }
    }
  );

  return toCarDetails(updatedCar);
}

export async function listRecentServicesForUser(
  username: string,
  limit = 6
): Promise<DashboardRecentService[]> {
  const db = await getDatabase();
  const cars = db.collection<CarDocument>("cars");
  const records = await cars.find({ ownerUsername: username }).toArray();

  return records
    .flatMap((car) =>
      car.serviceHistory.map((service) => ({
        carId: car.carId,
        carName: `${car.year} ${car.make} ${car.model}`,
        cost: service.cost,
        date: service.date,
        mileage: service.mileage,
        serviceId: service.serviceId,
        serviceType: service.serviceType
      }))
    )
    .sort((left, right) => right.date.getTime() - left.date.getTime())
    .slice(0, limit)
    .map((service) => ({
      ...service,
      date: formatMmDdYy(service.date)
    }));
}

export async function listAttentionVehicles(username: string): Promise<AttentionItem[]> {
  const db = await getDatabase();
  const cars = db.collection<CarDocument>("cars");
  const records = await cars.find({ ownerUsername: username }).sort({ carId: 1 }).toArray();

  return records
    .flatMap((car) =>
      getCategoryReminderStatuses(car)
        .filter((status) => status.needsAttention && status.reason)
        .map((status) => ({
          carId: car.carId,
          carName: `${car.year} ${car.make} ${car.model}`,
          currentMileage: car.currentMileage,
          daysUntilDue: status.daysUntilDue,
          lastServiceDate: formatMmDdYy(status.latestServiceDate),
          milesUntilDue: status.milesUntilDue,
          reason: status.reason ?? `${status.serviceType} needs attention.`,
          serviceType: status.serviceType,
          status: isOverdueReminder(status) ? ("overdue" as const) : ("due-soon" as const)
        }))
    )
    .sort(compareAttentionItems);
}

export async function getDashboardOverview(username: string): Promise<DashboardOverview> {
  const db = await getDatabase();
  const cars = db.collection<CarDocument>("cars");
  const records = await cars.find({ ownerUsername: username }).toArray();
  const reminderStatuses = records.flatMap((car) => getCategoryReminderStatuses(car));
  const totalVehicles = records.length;
  const totalServiceRecords = records.reduce((sum, car) => sum + car.serviceCount, 0);
  const totalExpenses = roundCurrency(records.reduce((sum, car) => sum + car.lifetimeCost, 0));
  const totalMileage = records.reduce((sum, car) => sum + car.currentMileage, 0);
  const knownServiceCosts = records.flatMap((car) =>
    car.serviceHistory.map((service) => service.cost).filter((cost): cost is number => cost !== null)
  );
  const flaggedVehicleCount = records.filter((car) => getCategoryReminderStatuses(car).some((status) => status.needsAttention)).length;
  const overdueCount = reminderStatuses.filter((status) => isOverdueReminder(status)).length;
  const dueSoonCount = reminderStatuses.filter(
    (status) => status.needsAttention && !isOverdueReminder(status)
  ).length;

  return {
    averageMileage: totalVehicles ? Math.round(totalMileage / totalVehicles) : null,
    averageServiceCost: knownServiceCosts.length
      ? roundCurrency(knownServiceCosts.reduce((sum, cost) => sum + cost, 0) / knownServiceCosts.length)
      : null,
    dueSoonCount,
    flaggedVehicleCount,
    onScheduleCount: reminderStatuses.filter((status) => !status.needsAttention).length,
    overdueCount,
    totalExpenses,
    totalServiceRecords,
    totalVehicles
  };
}

export async function getReportSummaryForUser(
  username: string,
  filters: ReportFilters = {}
): Promise<ReportSummary> {
  if (filters.carId !== undefined && filters.carId !== null) {
    if (!Number.isInteger(filters.carId) || filters.carId <= 0) {
      throw new Error("Report vehicle scope must be a valid car ID.");
    }
  }

  const db = await getDatabase();
  const cars = db.collection<CarDocument>("cars");
  const carFilter =
    filters.carId && Number.isInteger(filters.carId) && filters.carId > 0
      ? { ownerUsername: username, carId: filters.carId }
      : { ownerUsername: username };
  const records = await cars.find(carFilter).sort({ carId: 1 }).toArray();

  const services = records
    .flatMap((car) =>
      car.serviceHistory.map((service) => ({
        carId: car.carId,
        carName: `${car.year} ${car.make} ${car.model}`,
        cost: service.cost,
        date: service.date,
        description: service.description,
        mileage: service.mileage,
        notes: service.notes,
        serviceId: service.serviceId,
        serviceType: service.serviceType
      }))
    );

  return {
    ...summarizeReportServices({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      selectedCarId: filters.carId ?? null,
      services,
      vehiclesInScope: records.length
    }),
    vehiclesInScope: records.length
  };
}

async function findCarForUser(username: string, carId: number) {
  if (!Number.isInteger(carId) || carId <= 0) {
    throw new Error("Car ID must be a valid number.");
  }

  const db = await getDatabase();
  const cars = db.collection<CarDocument>("cars");
  const car = await cars.findOne({ ownerUsername: username, carId });

  if (!car) {
    throw new Error(`Car id ${carId} not found.`);
  }

  return car;
}

function toCarSummary(car: CarDocument): CarSummary {
  return {
    carId: car.carId,
    carName: `${car.year} ${car.make} ${car.model}`,
    currentMileage: car.currentMileage,
    lastServiceDate: formatMmDdYy(car.lastServiceDate),
    lifetimeExpenses: roundCurrency(car.lifetimeCost),
    make: car.make,
    model: car.model,
    serviceCount: car.serviceCount,
    year: car.year,
    imageUrl: car.imageUrl
  };
}

function toCarDetails(car: CarDocument): CarDetails {
  const sortedServices = [...car.serviceHistory]
    .sort((left, right) => right.date.getTime() - left.date.getTime())
    .map(toServiceHistoryItem);
  const mileageHistory = [...getMileageHistory(car)]
    .sort((left, right) => right.date.getTime() - left.date.getTime())
    .map(toMileageHistoryItem);
  const latestService = getLatestService(car);
  const knownServiceCosts = car.serviceHistory
    .map((service) => service.cost)
    .filter((cost): cost is number => cost !== null);
  const categoryReminders = getCategoryReminderStatuses(car);
  const reminderStatus = pickPrimaryReminderStatus(categoryReminders);
  const primaryRule = getPrimaryServiceRule(getServiceReminderRules(car));

  return {
    ...toCarSummary(car),
    averageServiceCost: knownServiceCosts.length
      ? roundCurrency(knownServiceCosts.reduce((sum, cost) => sum + cost, 0) / knownServiceCosts.length)
      : null,
    attentionReason: reminderStatus.reason,
    categoryReminders: categoryReminders.map((status) => ({
      daysUntilDue: status.daysUntilDue,
      intervalDays: status.intervalDays,
      intervalMiles: status.intervalMiles,
      isOverdue: isOverdueReminder(status),
      latestServiceDate: formatMmDdYy(status.latestServiceDate),
      latestServiceMileage: status.latestServiceMileage,
      milesUntilDue: status.milesUntilDue,
      needsAttention: status.needsAttention,
      nextServiceMileage: status.nextServiceMileage,
      reason: status.reason,
      serviceType: status.serviceType
    })),
    daysUntilService: reminderStatus.daysUntilDue,
    expenseTrend: buildExpenseTrend(car.serviceHistory),
    expensesByCategory: buildExpenseByCategory(car.serviceHistory),
    daysSinceLastService: latestService ? daysBetween(latestService.date, new Date()) : null,
    mileageTrend: buildMileageTrend(getMileageHistory(car)),
    milesSinceLastService: latestService ? Math.max(0, car.currentMileage - latestService.mileage) : null,
    milesUntilService: reminderStatus.milesUntilDue,
    mileageHistory,
    needsAttention: reminderStatus.needsAttention,
    nextServiceMileage: reminderStatus.nextServiceMileage,
    serviceReminderRules: getServiceReminderRules(car),
    serviceIntervalDays: primaryRule?.intervalDays ?? DEFAULT_SERVICE_INTERVAL_DAYS,
    serviceIntervalMiles: primaryRule?.intervalMiles ?? DEFAULT_SERVICE_INTERVAL_MILES,
    serviceHistory: sortedServices
  };
}

function toServiceHistoryItem(service: ServiceEntry): ServiceHistoryItem {
  return {
    serviceId: service.serviceId,
    date: formatMmDdYy(service.date),
    mileage: service.mileage,
    serviceType: service.serviceType,
    description: service.description,
    notes: service.notes,
    cost: service.cost
  };
}

function toMileageHistoryItem(entry: MileageEntry): MileageHistoryItem {
  return {
    canDelete: canManageMileageEntry(entry.source),
    canEdit: canManageMileageEntry(entry.source),
    entryId: entry.entryId,
    date: formatMmDdYy(entry.date),
    linkedServiceId: entry.serviceId,
    mileage: entry.mileage,
    notes: entry.notes,
    source: entry.source
  };
}

function getMileageHistory(car: CarDocument) {
  if (car.mileageHistory && car.mileageHistory.length > 0) {
    return car.mileageHistory;
  }

  return [
    {
      entryId: 0,
      date: car.createdAt,
      mileage: car.currentMileage,
      source: "initial",
      notes: "Vehicle imported without mileage history."
    }
  ];
}

function recalculateCar(car: CarDocument) {
  const serviceHistory = [...car.serviceHistory];
  const mileageHistory = getMileageHistory(car);
  const latestService = getLatestService({ ...car, serviceHistory });
  const currentMileage = mileageHistory.reduce((max, entry) => Math.max(max, entry.mileage), 0);
  const lifetimeCost = roundCurrency(
    serviceHistory.reduce((sum, service) => sum + (service.cost ?? 0), 0)
  );

  return {
    ...car,
    currentMileage,
    lastServiceDate: latestService?.date ?? null,
    lifetimeCost,
    mileageHistory,
    serviceCount: serviceHistory.length
  };
}

function getLatestService(car: CarDocument) {
  if (car.serviceHistory.length === 0) {
    return null;
  }

  return [...car.serviceHistory].sort((left, right) => right.date.getTime() - left.date.getTime())[0];
}

function getAttentionReason(car: CarDocument) {
  return pickPrimaryReminderStatus(getCategoryReminderStatuses(car)).reason;
}

function validateVehicleFields(input: CreateCarInput | UpdateCarInput) {
  const make = input.make.trim();
  const model = input.model.trim();
  const year = Number(input.year);
  const mileage = Number(input.mileage);
  const imageUrl = input.imageUrl.trim();
  const serviceReminderRules = validateReminderRules(input.serviceReminderRules);

  if (!make || !model) {
    throw new Error("Make and model are required.");
  }

  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new Error("Enter a valid year.");
  }

  if (!Number.isInteger(mileage) || mileage < 0) {
    throw new Error("Mileage cannot be negative.");
  }

  return { imageUrl, make, mileage, model, serviceReminderRules, year };
}

function parseMmDdYy(value: string) {
  const trimmed = value.trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new Error("Date must be in mm/dd/yy format.");
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = 2000 + Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Date must be in mm/dd/yy format.");
  }

  return date;
}

function parseIsoDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return new Date();
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new Error("Mileage date must be in yyyy-mm-dd format.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Mileage date must be in yyyy-mm-dd format.");
  }

  return date;
}

function formatMmDdYy(date: Date | null) {
  if (!date) {
    return "N/A";
  }

  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

function parseCost(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error("Cost must be a valid amount or blank.");
  }

  if (parsed < 0) {
    throw new Error("Cost cannot be negative.");
  }

  return roundCurrency(parsed);
}

async function nextSequence(name: string) {
  const db = await getDatabase();
  const counters = db.collection<{ _id: string; seq: number }>("counters");
  const result = await counters.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );

  return result?.seq ?? 1;
}

function getServiceIntervalMiles(car: CarDocument) {
  return car.serviceIntervalMiles ?? DEFAULT_SERVICE_INTERVAL_MILES;
}

function getServiceIntervalDays(car: CarDocument) {
  return car.serviceIntervalDays ?? DEFAULT_SERVICE_INTERVAL_DAYS;
}

function getReminderStatus(car: CarDocument) {
  if (Array.isArray(car.serviceReminderRules)) {
    if (car.serviceReminderRules.length === 0) {
      return {
        daysUntilDue: null,
        isOverdue: false,
        milesUntilDue: null,
        needsAttention: false,
        nextServiceMileage: null,
        reason: null
      };
    }

    return pickPrimaryReminderStatus(getCategoryReminderStatuses(car));
  }

  return calculateReminderStatus({
    currentDate: new Date(),
    currentMileage: car.currentMileage,
    latestService: getLatestService(car),
    serviceIntervalDays: getServiceIntervalDays(car),
    serviceIntervalMiles: getServiceIntervalMiles(car)
  });
}

function getServiceReminderRules(car: CarDocument) {
  if (Array.isArray(car.serviceReminderRules)) {
    return validateReminderRules(car.serviceReminderRules);
  }

  return [
    {
      intervalDays: getServiceIntervalDays(car),
      intervalMiles: getServiceIntervalMiles(car),
      serviceType: COMMON_SERVICE_TYPES[0]
    }
  ];
}

function getPrimaryServiceRule(rules: ReminderRuleDocument[]) {
  return rules.find((rule) => rule.serviceType === COMMON_SERVICE_TYPES[0]) ?? rules[0] ?? null;
}

function getCategoryReminderStatuses(car: CarDocument) {
  const rules = getServiceReminderRules(car);

  if (rules.length === 0) {
    return [];
  }

  return calculateCategoryReminderStatuses({
    currentDate: new Date(),
    currentMileage: car.currentMileage,
    rules,
    serviceHistory: car.serviceHistory
  });
}

function validateReminderRules(input: unknown): ReminderRuleDocument[] {
  if (!Array.isArray(input)) {
    throw new Error("Reminder rules must be a list.");
  }

  const seenTypes = new Set<string>();
  return input.map((rule, index) => {
    const serviceType = String((rule as ReminderRuleDocument | undefined)?.serviceType ?? "").trim();
    const intervalMiles = Number((rule as ReminderRuleDocument | undefined)?.intervalMiles);
    const intervalDays = Number((rule as ReminderRuleDocument | undefined)?.intervalDays);

    if (!serviceType) {
      throw new Error(`Reminder rule ${index + 1} is missing a service category.`);
    }

    if (!COMMON_SERVICE_TYPES.includes(serviceType as (typeof COMMON_SERVICE_TYPES)[number])) {
      throw new Error(`Reminder rule ${serviceType} is not a supported service category.`);
    }

    if (seenTypes.has(serviceType)) {
      throw new Error(`Reminder rules can only include ${serviceType} once.`);
    }

    if (!Number.isInteger(intervalMiles) || intervalMiles <= 0) {
      throw new Error(`${serviceType} mileage interval must be a positive whole number.`);
    }

    if (!Number.isInteger(intervalDays) || intervalDays <= 0) {
      throw new Error(`${serviceType} day interval must be a positive whole number.`);
    }

    seenTypes.add(serviceType);
    return {
      intervalDays,
      intervalMiles,
      serviceType
    };
  });
}

function compareAttentionItems(left: AttentionItem, right: AttentionItem) {
  const statusOrder = left.status === right.status ? 0 : left.status === "overdue" ? -1 : 1;
  if (statusOrder !== 0) {
    return statusOrder;
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

  return left.carName.localeCompare(right.carName) || left.serviceType.localeCompare(right.serviceType);
}
