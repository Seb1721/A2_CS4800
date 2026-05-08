import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import ts from "typescript";

const harness = await loadCarsHarness();

test("createCar allows an empty reminder rule list", async () => {
  const db = createMockDatabase();
  harness.setMockDatabase(db);

  const car = await harness.cars.createCar("driver", {
    imageUrl: "",
    make: "Honda",
    mileage: 100000,
    model: "Civic",
    serviceReminderRules: [],
    year: 2020
  });

  assert.deepEqual(car.serviceReminderRules, []);
  assert.equal(car.needsAttention, false);
  assert.equal(car.categoryReminders.length, 0);
});

test("createCar rejects duplicate reminder categories", async () => {
  const db = createMockDatabase();
  harness.setMockDatabase(db);

  await assert.rejects(
    () =>
      harness.cars.createCar("driver", {
        imageUrl: "",
        make: "Honda",
        mileage: 100000,
        model: "Civic",
        serviceReminderRules: [
          { intervalDays: 180, intervalMiles: 5000, serviceType: "Oil Change" },
          { intervalDays: 90, intervalMiles: 3000, serviceType: "Oil Change" }
        ],
        year: 2020
      }),
    /Reminder rules can only include Oil Change once/
  );
});

test("createCar rejects unsupported reminder categories and invalid intervals", async () => {
  const db = createMockDatabase();
  harness.setMockDatabase(db);

  await assert.rejects(
    () =>
      harness.cars.createCar("driver", {
        imageUrl: "",
        make: "Honda",
        mileage: 100000,
        model: "Civic",
        serviceReminderRules: [{ intervalDays: 180, intervalMiles: 5000, serviceType: "Wipers" }],
        year: 2020
      }),
    /not a supported service category/
  );

  await assert.rejects(
    () =>
      harness.cars.createCar("driver", {
        imageUrl: "",
        make: "Honda",
        mileage: 100000,
        model: "Civic",
        serviceReminderRules: [{ intervalDays: 0, intervalMiles: 5000, serviceType: "Oil Change" }],
        year: 2020
      }),
    /day interval must be a positive whole number/
  );
});

test("updateMileageForUser rejects a lower mileage unless correction is allowed", async () => {
  const db = createMockDatabase();
  harness.setMockDatabase(db);

  const car = await harness.cars.createCar("driver", {
    imageUrl: "",
    make: "Toyota",
    mileage: 100000,
    model: "Corolla",
    serviceReminderRules: [],
    year: 2021
  });

  await assert.rejects(
    () =>
      harness.cars.updateMileageForUser("driver", {
        allowCorrection: false,
        carId: car.carId,
        date: "2026-05-05",
        mileage: 99999,
        notes: "Correction without confirmation"
      }),
    /Mileage cannot decrease unless you confirm it is a correction/
  );
});

test("service-linked mileage entries cannot be edited or deleted directly", async () => {
  const db = createMockDatabase();
  harness.setMockDatabase(db);

  const car = await harness.cars.createCar("driver", {
    imageUrl: "",
    make: "Mazda",
    mileage: 50000,
    model: "3",
    serviceReminderRules: [],
    year: 2019
  });

  const withService = await harness.cars.addServiceToCar("driver", {
    carId: car.carId,
    cost: 89.99,
    description: "Oil and filter",
    mileage: 50500,
    notes: "",
    serviceDate: "05/01/26",
    serviceType: "Oil Change"
  });
  const serviceEntry = withService.mileageHistory.find((entry) => entry.source === "service");

  assert.ok(serviceEntry);

  await assert.rejects(
    () =>
      harness.cars.updateMileageEntryForUser("driver", car.carId, serviceEntry.entryId, {
        allowCorrection: false,
        date: "2026-05-02",
        mileage: 50550,
        notes: "Should fail"
      }),
    /must be updated from its original workflow/
  );

  await assert.rejects(
    () => harness.cars.deleteMileageEntryForUser("driver", car.carId, serviceEntry.entryId),
    /must be deleted from its original workflow/
  );
});

test("addServiceToCar accepts historical service mileage without lowering current mileage", async () => {
  const db = createMockDatabase();
  harness.setMockDatabase(db);

  const car = await harness.cars.createCar("driver", {
    imageUrl: "",
    make: "Honda",
    mileage: 90000,
    model: "Accord",
    serviceReminderRules: [],
    year: 2016
  });

  const result = await harness.cars.addServiceToCar("driver", {
    carId: car.carId,
    cost: 75,
    description: "",
    mileage: 85000,
    notes: "",
    serviceDate: "02/01/26",
    serviceType: "Oil Change"
  });

  assert.equal(result.currentMileage, 90000);
  assert.equal(result.lastServiceDate, "02/01/26");
  assert.equal(result.lifetimeExpenses, 75);
  assert.equal(result.serviceHistory[0].mileage, 85000);
  assert.ok(result.mileageHistory.some((entry) => entry.linkedServiceId === result.serviceHistory[0].serviceId));
});

test("updateServiceForCar rejects invalid service dates", async () => {
  const db = createMockDatabase();
  harness.setMockDatabase(db);

  const car = await harness.cars.createCar("driver", {
    imageUrl: "",
    make: "Subaru",
    mileage: 40000,
    model: "Impreza",
    serviceReminderRules: [],
    year: 2018
  });

  const withService = await harness.cars.addServiceToCar("driver", {
    carId: car.carId,
    cost: 40,
    description: "Rotation",
    mileage: 40500,
    notes: "",
    serviceDate: "04/15/26",
    serviceType: "Tire Service"
  });
  const service = withService.serviceHistory[0];

  await assert.rejects(
    () =>
      harness.cars.updateServiceForCar("driver", car.carId, service.serviceId, {
        carId: car.carId,
        cost: 40,
        description: "Rotation",
        mileage: 40500,
        notes: "",
        serviceDate: "02/29/25",
        serviceType: "Tire Service"
      }),
    /Date must be in mm\/dd\/yy format/
  );
});

test("updateServiceForCar recalculates lifetime cost when a priced service becomes blank", async () => {
  const db = createMockDatabase();
  harness.setMockDatabase(db);

  const car = await harness.cars.createCar("driver", {
    imageUrl: "",
    make: "Ford",
    mileage: 70000,
    model: "Focus",
    serviceReminderRules: [],
    year: 2017
  });

  let updatedCar = await harness.cars.addServiceToCar("driver", {
    carId: car.carId,
    cost: 50,
    description: "Oil",
    mileage: 70500,
    notes: "",
    serviceDate: "03/01/26",
    serviceType: "Oil Change"
  });
  updatedCar = await harness.cars.addServiceToCar("driver", {
    carId: car.carId,
    cost: 120,
    description: "Brakes",
    mileage: 71000,
    notes: "",
    serviceDate: "04/01/26",
    serviceType: "Brake Service"
  });

  const brakeService = updatedCar.serviceHistory.find((service) => service.serviceType === "Brake Service");
  assert.ok(brakeService);

  const result = await harness.cars.updateServiceForCar("driver", car.carId, brakeService.serviceId, {
    carId: car.carId,
    cost: "",
    description: "Brakes",
    mileage: 71000,
    notes: "",
    serviceDate: "04/01/26",
    serviceType: "Brake Service"
  });

  assert.equal(result.lifetimeExpenses, 50);
  assert.equal(result.averageServiceCost, 50);
  assert.equal(
    result.serviceHistory.find((service) => service.serviceId === brakeService.serviceId)?.cost,
    null
  );
});

test("deleteServiceForCar removes service-created mileage from current mileage", async () => {
  const db = createMockDatabase();
  harness.setMockDatabase(db);

  const car = await harness.cars.createCar("driver", {
    imageUrl: "",
    make: "Honda",
    mileage: 170000,
    model: "Civic",
    serviceReminderRules: [],
    year: 2018
  });

  const withService = await harness.cars.addServiceToCar("driver", {
    carId: car.carId,
    cost: 60,
    description: "",
    mileage: 176000,
    notes: "",
    serviceDate: "05/07/26",
    serviceType: "Oil Change"
  });

  assert.equal(withService.currentMileage, 176000);

  const service = withService.serviceHistory[0];
  const result = await harness.cars.deleteServiceForCar("driver", car.carId, service.serviceId);

  assert.equal(result.currentMileage, 170000);
  assert.equal(result.serviceHistory.length, 0);
  assert.equal(result.mileageHistory.some((entry) => entry.linkedServiceId === service.serviceId), false);
});

test.todo("mileage corrections should persist after later service recalculation");

function createMockDatabase(initialState = {}) {
  const state = {
    cars: structuredClone(initialState.cars ?? []),
    counters: structuredClone(initialState.counters ?? [])
  };

  return {
    collection(name) {
      if (name === "cars") {
        return createCollection(state.cars);
      }

      if (name === "counters") {
        return createCollection(state.counters);
      }

      throw new Error(`Unsupported mock collection: ${name}`);
    }
  };
}

function createCollection(records) {
  return {
    async deleteOne(filter) {
      const index = records.findIndex((record) => matchesFilter(record, filter));
      if (index === -1) {
        return { deletedCount: 0 };
      }

      records.splice(index, 1);
      return { deletedCount: 1 };
    },

    find(filter = {}) {
      const matched = records.filter((record) => matchesFilter(record, filter)).map(cloneRecord);

      return {
        sort(sortSpec = {}) {
          const entries = Object.entries(sortSpec);
          const sorted = [...matched].sort((left, right) => compareBySortSpec(left, right, entries));

          return {
            async toArray() {
              return sorted.map(cloneRecord);
            }
          };
        },

        async toArray() {
          return matched.map(cloneRecord);
        }
      };
    },

    async findOne(filter) {
      const found = records.find((record) => matchesFilter(record, filter));
      return found ? cloneRecord(found) : null;
    },

    async findOneAndUpdate(filter, update, options = {}) {
      let index = records.findIndex((record) => matchesFilter(record, filter));

      if (index === -1 && options.upsert) {
        records.push({ ...filter });
        index = records.length - 1;
      }

      if (index === -1) {
        return null;
      }

      const record = records[index];
      applyUpdate(record, update);
      return cloneRecord(record);
    },

    async insertOne(document) {
      records.push(cloneRecord(document));
      return { acknowledged: true };
    },

    async updateOne(filter, update) {
      const record = records.find((item) => matchesFilter(item, filter));
      if (!record) {
        return { matchedCount: 0, modifiedCount: 0 };
      }

      applyUpdate(record, update);
      return { matchedCount: 1, modifiedCount: 1 };
    }
  };
}

function applyUpdate(record, update = {}) {
  if (update.$inc) {
    for (const [field, amount] of Object.entries(update.$inc)) {
      record[field] = (record[field] ?? 0) + amount;
    }
  }

  if (update.$set) {
    for (const [field, value] of Object.entries(update.$set)) {
      record[field] = cloneRecord(value);
    }
  }
}

function compareBySortSpec(left, right, entries) {
  for (const [field, direction] of entries) {
    const leftValue = left[field];
    const rightValue = right[field];

    if (leftValue === rightValue) {
      continue;
    }

    if (leftValue instanceof Date && rightValue instanceof Date) {
      return direction * (leftValue.getTime() - rightValue.getTime());
    }

    return direction * (leftValue < rightValue ? -1 : 1);
  }

  return 0;
}

function matchesFilter(record, filter = {}) {
  return Object.entries(filter).every(([field, expected]) => {
    if (expected && typeof expected === "object" && "$ne" in expected) {
      return record[field] !== expected.$ne;
    }

    return record[field] === expected;
  });
}

function cloneRecord(value) {
  return structuredClone(value);
}

async function loadCarsHarness() {
  const tempDir = await mkdtemp(path.join(tmpdir(), "carkeeper-cars-tests-"));

  await transpileFile({
    outputPath: path.join(tempDir, "car-insights.mjs"),
    sourcePath: path.resolve("lib", "car-insights.ts")
  });
  await transpileFile({
    outputPath: path.join(tempDir, "service-types.mjs"),
    sourcePath: path.resolve("lib", "service-types.ts")
  });
  await writeFile(
    path.join(tempDir, "mongodb.mjs"),
    [
      "let currentDb = null;",
      "export function __setMockDatabase(db) { currentDb = db; }",
      'export async function getDatabase() { if (!currentDb) { throw new Error("Mock database not set."); } return currentDb; }'
    ].join("\n"),
    "utf8"
  );

  const carsSourcePath = path.resolve("lib", "cars.ts");
  const carsSource = await readFile(carsSourcePath, "utf8");
  const rewrittenCarsSource = carsSource
    .replaceAll('"@/lib/car-insights"', '"./car-insights.mjs"')
    .replaceAll('"@/lib/mongodb"', '"./mongodb.mjs"')
    .replaceAll('"@/lib/service-types"', '"./service-types.mjs"');

  await transpileSource({
    outputPath: path.join(tempDir, "cars.mjs"),
    source: rewrittenCarsSource,
    sourcePath: carsSourcePath
  });

  const cars = await import(pathToFileURL(path.join(tempDir, "cars.mjs")).href);
  const mongodb = await import(pathToFileURL(path.join(tempDir, "mongodb.mjs")).href);

  return {
    cars,
    setMockDatabase: mongodb.__setMockDatabase
  };
}

async function transpileFile({ outputPath, sourcePath }) {
  const source = await readFile(sourcePath, "utf8");
  await transpileSource({ outputPath, source, sourcePath });
}

async function transpileSource({ outputPath, source, sourcePath }) {
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    },
    fileName: sourcePath
  });

  await writeFile(outputPath, transpiled.outputText, "utf8");
}
