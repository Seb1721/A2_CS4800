import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import ts from "typescript";

const reporting = await loadModule("lib/reporting-core.ts", "reporting-core");

test("summarizeReportServices filters rows by date range and computes totals", () => {
  const summary = reporting.summarizeReportServices({
    dateFrom: "2026-02-01",
    dateTo: "2026-03-31",
    selectedCarId: 12,
    services: [
      {
        carId: 12,
        carName: "2020 Honda Civic",
        cost: 70,
        date: new Date("2026-01-10T00:00:00.000Z"),
        description: "Early oil change",
        mileage: 20100,
        notes: "",
        serviceId: 1,
        serviceType: "Oil Change"
      },
      {
        carId: 12,
        carName: "2020 Honda Civic",
        cost: 320,
        date: new Date("2026-02-20T00:00:00.000Z"),
        description: "Front pads",
        mileage: 22300,
        notes: "Dealer visit",
        serviceId: 2,
        serviceType: "Brake Service"
      },
      {
        carId: 12,
        carName: "2020 Honda Civic",
        cost: 80,
        date: new Date("2026-03-05T00:00:00.000Z"),
        description: "Oil and filter",
        mileage: 22900,
        notes: "",
        serviceId: 3,
        serviceType: "Oil Change"
      }
    ],
    vehiclesInScope: 1
  });

  assert.equal(summary.serviceCount, 2);
  assert.equal(summary.totalExpenses, 400);
  assert.equal(summary.averageServiceCost, 200);
  assert.equal(summary.highestCostService?.serviceId, 2);
  assert.equal(summary.services[0].date, "03/05/26");
  assert.deepEqual(summary.servicesByCategory, [
    { category: "Brake Service", count: 1, totalCost: 320 },
    { category: "Oil Change", count: 1, totalCost: 80 }
  ]);
});

test("summarizeReportServices rejects inverted date ranges", () => {
  assert.throws(
    () =>
      reporting.summarizeReportServices({
        dateFrom: "2026-04-01",
        dateTo: "2026-03-01",
        services: [],
        vehiclesInScope: 0
      }),
    /Report start date must be before the end date/
  );
});

test("buildReportCsv escapes commas and quotes in text fields", () => {
  const csv = reporting.buildReportCsv({
    services: [
      {
        carId: 5,
        carName: '2019 Ford "Focus", SE',
        cost: 125.5,
        date: "04/15/26",
        description: 'Dealer said "replace filter", completed',
        mileage: 55200,
        notes: "Included tire rotation, inspection",
        serviceId: 14,
        serviceType: "Inspection"
      }
    ]
  });

  assert.match(csv, /"2019 Ford ""Focus"", SE"/);
  assert.match(csv, /"Dealer said ""replace filter"", completed"/);
  assert.match(csv, /"Included tire rotation, inspection"/);
});

async function loadModule(sourceRelativePath, tempName) {
  const sourcePath = path.resolve(sourceRelativePath);
  const source = await readFile(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    },
    fileName: sourcePath
  });

  const tempDir = await mkdtemp(path.join(tmpdir(), "carkeeper-tests-"));
  const tempFile = path.join(tempDir, `${tempName}.mjs`);
  await writeFile(tempFile, transpiled.outputText, "utf8");

  return import(pathToFileURL(tempFile).href);
}
