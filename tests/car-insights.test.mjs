import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import ts from "typescript";

const insights = await loadInsightsModule();

test("calculateReminderStatus keeps vehicles without service history unflagged", () => {
  const result = insights.calculateReminderStatus({
    currentMileage: 120000,
    latestService: null
  });

  assert.equal(result.needsAttention, false);
  assert.equal(result.reason, null);
  assert.equal(result.nextServiceMileage, null);
});

test("calculateReminderStatus starts due-soon alerts at half the mileage interval", () => {
  const early = insights.calculateReminderStatus({
    currentDate: new Date("2026-05-05T00:00:00.000Z"),
    currentMileage: 122400,
    latestService: {
      date: new Date("2026-04-01T00:00:00.000Z"),
      mileage: 120000
    },
    serviceIntervalDays: 180,
    serviceIntervalMiles: 5000
  });
  const dueSoon = insights.calculateReminderStatus({
    currentDate: new Date("2026-05-05T00:00:00.000Z"),
    currentMileage: 122500,
    latestService: {
      date: new Date("2026-04-01T00:00:00.000Z"),
      mileage: 120000
    },
    serviceIntervalDays: 180,
    serviceIntervalMiles: 5000
  });

  assert.equal(early.needsAttention, false);
  assert.equal(dueSoon.needsAttention, true);
  assert.equal(dueSoon.reason, "Service due in 2,500 miles.");
});

test("calculateCategoryReminderStatuses can use initial mileage as a reminder baseline", () => {
  const result = insights.calculateCategoryReminderStatuses({
    baselineService: {
      date: new Date("2026-01-01T00:00:00.000Z"),
      mileage: 100000
    },
    currentDate: new Date("2026-03-01T00:00:00.000Z"),
    currentMileage: 105100,
    rules: [{ intervalDays: 180, intervalMiles: 5000, serviceType: "Oil Change" }],
    serviceHistory: []
  });

  assert.equal(result[0].needsAttention, true);
  assert.equal(result[0].isOverdue, true);
  assert.equal(result[0].reason, "Oil Change overdue by 100 miles.");
});

test("calculateReminderStatus reports upcoming mileage-based service", () => {
  const result = insights.calculateReminderStatus({
    currentDate: new Date("2026-05-05T00:00:00.000Z"),
    currentMileage: 124700,
    latestService: {
      date: new Date("2026-02-01T00:00:00.000Z"),
      mileage: 120000
    },
    serviceIntervalDays: 180,
    serviceIntervalMiles: 5000
  });

  assert.equal(result.needsAttention, true);
  assert.equal(result.milesUntilDue, 300);
  assert.equal(result.reason, "Service due in 300 miles.");
  assert.equal(result.nextServiceMileage, 125000);
});

test("calculateReminderStatus reports overdue time-based service", () => {
  const result = insights.calculateReminderStatus({
    currentDate: new Date("2026-05-05T00:00:00.000Z"),
    currentMileage: 101000,
    latestService: {
      date: new Date("2025-10-01T00:00:00.000Z"),
      mileage: 100000
    },
    serviceIntervalDays: 180,
    serviceIntervalMiles: 5000
  });

  assert.equal(result.needsAttention, true);
  assert.equal(result.daysUntilDue, 0);
  assert.equal(result.reason, "36 days overdue for service.");
});

test("calculateCategoryReminderStatuses tracks configured categories independently", () => {
  const result = insights.calculateCategoryReminderStatuses({
    currentDate: new Date("2026-05-05T00:00:00.000Z"),
    currentMileage: 124700,
    rules: [
      { intervalDays: 180, intervalMiles: 5000, serviceType: "Oil Change" },
      { intervalDays: 365, intervalMiles: 12000, serviceType: "Tire Service" }
    ],
    serviceHistory: [
      {
        cost: 70,
        date: new Date("2026-02-01T00:00:00.000Z"),
        mileage: 120000,
        serviceType: "Oil Change"
      },
      {
        cost: 120,
        date: new Date("2025-07-01T00:00:00.000Z"),
        mileage: 112500,
        serviceType: "Tire Service"
      }
    ]
  });

  assert.equal(result[0].serviceType, "Tire Service");
  assert.equal(result[0].reason, "Tire Service overdue by 200 miles.");
  assert.equal(result[0].needsAttention, true);
  assert.equal(result[1].serviceType, "Oil Change");
  assert.equal(result[1].reason, "Oil Change due in 300 miles.");
});

test("pickPrimaryReminderStatus returns the most urgent category reminder", () => {
  const statuses = insights.calculateCategoryReminderStatuses({
    currentDate: new Date("2026-05-05T00:00:00.000Z"),
    currentMileage: 126500,
    rules: [
      { intervalDays: 180, intervalMiles: 5000, serviceType: "Oil Change" },
      { intervalDays: 365, intervalMiles: 12000, serviceType: "Tire Service" }
    ],
    serviceHistory: [
      {
        cost: 70,
        date: new Date("2026-01-01T00:00:00.000Z"),
        mileage: 120000,
        serviceType: "Oil Change"
      },
      {
        cost: 120,
        date: new Date("2026-04-01T00:00:00.000Z"),
        mileage: 125000,
        serviceType: "Tire Service"
      }
    ]
  });

  const primary = insights.pickPrimaryReminderStatus(statuses);
  assert.equal(primary.reason, "Oil Change overdue by 1,500 miles.");
  assert.equal(primary.needsAttention, true);
});

test("buildExpenseByCategory groups totals and sorts highest cost first", () => {
  const result = insights.buildExpenseByCategory([
    { cost: 65, date: new Date("2026-01-05T00:00:00.000Z"), mileage: 100000, serviceType: "Oil Change" },
    { cost: 550, date: new Date("2026-02-10T00:00:00.000Z"), mileage: 101500, serviceType: "Brake Service" },
    { cost: 75, date: new Date("2026-03-15T00:00:00.000Z"), mileage: 103000, serviceType: "Oil Change" }
  ]);

  assert.deepEqual(result[0], {
    category: "Brake Service",
    count: 1,
    totalCost: 550
  });
  assert.deepEqual(result[1], {
    category: "Oil Change",
    count: 2,
    totalCost: 140
  });
});

test("buildMileageTrend keeps the highest mileage recorded per month", () => {
  const result = insights.buildMileageTrend([
    { date: new Date("2026-01-01T00:00:00.000Z"), mileage: 100000 },
    { date: new Date("2026-01-20T00:00:00.000Z"), mileage: 100900 },
    { date: new Date("2026-02-14T00:00:00.000Z"), mileage: 101500 }
  ]);

  assert.deepEqual(result, [
    { label: "Jan 2026", value: 100900 },
    { label: "Feb 2026", value: 101500 }
  ]);
});

test("trend filters narrow service and mileage history by date and category", () => {
  const services = insights.filterServiceHistoryByTrend(
    [
      { cost: 65, date: new Date("2026-01-05T00:00:00.000Z"), mileage: 100000, serviceType: "Oil Change" },
      { cost: 550, date: new Date("2026-02-10T00:00:00.000Z"), mileage: 101500, serviceType: "Brake Service" },
      { cost: 75, date: new Date("2026-03-15T00:00:00.000Z"), mileage: 103000, serviceType: "Oil Change" }
    ],
    {
      dateFrom: new Date("2026-02-01T00:00:00.000Z"),
      dateTo: new Date("2026-03-31T00:00:00.000Z"),
      serviceType: "Oil Change"
    }
  );
  const mileage = insights.filterMileageHistoryByTrend(
    [
      { date: new Date("2026-01-01T00:00:00.000Z"), mileage: 100000 },
      { date: new Date("2026-02-01T00:00:00.000Z"), mileage: 101000 },
      { date: new Date("2026-03-01T00:00:00.000Z"), mileage: 102500 }
    ],
    {
      dateFrom: new Date("2026-02-01T00:00:00.000Z"),
      dateTo: new Date("2026-03-31T00:00:00.000Z")
    }
  );

  assert.equal(services.length, 1);
  assert.equal(services[0].serviceType, "Oil Change");
  assert.equal(mileage.length, 2);
  assert.equal(mileage[0].mileage, 101000);
});

test("trend calculations derive miles driven and monthly averages from filtered history", () => {
  const mileageHistory = [
    { date: new Date("2026-01-05T00:00:00.000Z"), mileage: 100000 },
    { date: new Date("2026-02-05T00:00:00.000Z"), mileage: 101200 },
    { date: new Date("2026-03-05T00:00:00.000Z"), mileage: 102700 }
  ];
  const serviceHistory = [
    { cost: 80, date: new Date("2026-01-10T00:00:00.000Z"), mileage: 100500, serviceType: "Oil Change" },
    { cost: 320, date: new Date("2026-02-15T00:00:00.000Z"), mileage: 101800, serviceType: "Brake Service" },
    { cost: null, date: new Date("2026-03-10T00:00:00.000Z"), mileage: 102600, serviceType: "Inspection" }
  ];

  assert.equal(insights.calculateMilesDriven(mileageHistory), 2700);
  assert.equal(insights.calculateAverageMonthlyMileage(mileageHistory), 900);
  assert.equal(insights.calculateAverageMonthlyExpense(serviceHistory), 200);
  assert.equal(insights.calculateAverageMonthlyServiceFrequency(serviceHistory), 1);
});

test("isOverdueReminder detects overdue statuses only", () => {
  const overdue = insights.calculateReminderStatus({
    currentDate: new Date("2026-05-05T00:00:00.000Z"),
    currentMileage: 126500,
    latestService: {
      date: new Date("2026-01-01T00:00:00.000Z"),
      mileage: 120000
    },
    serviceIntervalDays: 180,
    serviceIntervalMiles: 5000
  });
  const upcoming = insights.calculateReminderStatus({
    currentDate: new Date("2026-05-05T00:00:00.000Z"),
    currentMileage: 124600,
    latestService: {
      date: new Date("2026-03-15T00:00:00.000Z"),
      mileage: 120000
    },
    serviceIntervalDays: 180,
    serviceIntervalMiles: 5000
  });

  assert.equal(insights.isOverdueReminder(overdue), true);
  assert.equal(insights.isOverdueReminder(upcoming), false);
});

test("canManageMileageEntry only allows manual and correction entries", () => {
  assert.equal(insights.canManageMileageEntry("manual"), true);
  assert.equal(insights.canManageMileageEntry("correction"), true);
  assert.equal(insights.canManageMileageEntry("service"), false);
  assert.equal(insights.canManageMileageEntry("initial"), false);
  assert.equal(insights.canManageMileageEntry("profile-update"), false);
});

async function loadInsightsModule() {
  const sourcePath = path.resolve("lib", "car-insights.ts");
  const source = await readFile(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    },
    fileName: sourcePath
  });

  const tempDir = await mkdtemp(path.join(tmpdir(), "carkeeper-tests-"));
  const tempFile = path.join(tempDir, "car-insights.mjs");
  await writeFile(tempFile, transpiled.outputText, "utf8");

  return import(pathToFileURL(tempFile).href);
}
