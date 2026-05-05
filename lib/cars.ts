import { getDatabase } from "@/lib/mongodb";
import type { CarDetails, CarSummary, ServiceHistoryItem } from "@/lib/types";

type ServiceEntry = {
  serviceId: number;
  date: Date;
  mileage: number;
  serviceType: string;
  description: string;
  notes: string;
  cost: number | null;
};

type CarDocument = {
  carId: number;
  ownerUsername: string;
  make: string;
  model: string;
  year: number;
  currentMileage: number;
  lastServiceDate: Date | null;
  serviceHistory: ServiceEntry[];
  serviceCount: number;
  lifetimeCost: number;
  imageUrl: string;
  createdAt: Date;
};

type CreateCarInput = {
  make: string;
  model: string;
  year: number;
  mileage: number;
  imageUrl: string;
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

export async function listCarsForUser(username: string): Promise<CarSummary[]> {
  const db = await getDatabase();
  const cars = db.collection<CarDocument>("cars");
  const records = await cars.find({ ownerUsername: username }).sort({ carId: 1 }).toArray();
  return records.map(toCarSummary);
}

export async function getCarDetailsForUser(username: string, carId: number): Promise<CarDetails> {
  if (!Number.isInteger(carId) || carId <= 0) {
    throw new Error("Car ID must be a valid number.");
  }

  const db = await getDatabase();
  const cars = db.collection<CarDocument>("cars");
  const car = await cars.findOne({ ownerUsername: username, carId });

  if (!car) {
    throw new Error(`Car id ${carId} not found.`);
  }

  return toCarDetails(car);
}

export async function createCar(username: string, input: CreateCarInput): Promise<CarDetails> {
  const make = input.make.trim();
  const model = input.model.trim();
  const year = Number(input.year);
  const mileage = Number(input.mileage);
  const imageUrl = input.imageUrl.trim();

  if (!make || !model) {
    throw new Error("Make and model are required.");
  }

  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new Error("Enter a valid year.");
  }

  if (!Number.isInteger(mileage) || mileage < 0) {
    throw new Error("Mileage cannot be negative.");
  }

  const db = await getDatabase();
  const cars = db.collection<CarDocument>("cars");
  const carId = await nextSequence("cars");

  const record: CarDocument = {
    carId,
    ownerUsername: username,
    make,
    model,
    year,
    currentMileage: mileage,
    lastServiceDate: null,
    serviceHistory: [],
    serviceCount: 0,
    lifetimeCost: 0,
    imageUrl,
    createdAt: new Date()
  };

  await cars.insertOne(record);
  return toCarDetails(record);
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
  const car = await cars.findOne({ ownerUsername: username, carId: input.carId });

  if (!car) {
    throw new Error(`Car id ${input.carId} not found.`);
  }

  const serviceEntry: ServiceEntry = {
    serviceId: await nextSequence("services"),
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

  await cars.updateOne(
    { ownerUsername: username, carId: input.carId },
    {
      $set: {
        serviceHistory: updatedHistory,
        lastServiceDate: serviceDate,
        serviceCount: car.serviceCount + 1,
        currentMileage: updatedMileage,
        lifetimeCost: updatedLifetimeCost
      }
    }
  );

  return toCarDetails({
    ...car,
    serviceHistory: updatedHistory,
    lastServiceDate: serviceDate,
    serviceCount: car.serviceCount + 1,
    currentMileage: updatedMileage,
    lifetimeCost: updatedLifetimeCost
  });
}

function toCarSummary(car: CarDocument): CarSummary {
  return {
    carId: car.carId,
    carName: `${car.year} ${car.make} ${car.model}`,
    currentMileage: car.currentMileage,
    lastServiceDate: formatMmDdYy(car.lastServiceDate),
    lifetimeExpenses: roundCurrency(car.lifetimeCost),
    serviceCount: car.serviceCount,
    imageUrl: car.imageUrl
  };
}

function toCarDetails(car: CarDocument): CarDetails {
  return {
    ...toCarSummary(car),
    serviceHistory: [...car.serviceHistory]
      .sort((left, right) => right.date.getTime() - left.date.getTime())
      .map(toServiceHistoryItem)
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

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
