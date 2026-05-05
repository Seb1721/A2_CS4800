import { NextResponse } from "next/server";

import { ensureAppSetup } from "@/lib/app-setup";
import { getCurrentUser } from "@/lib/auth";
import { buildReportCsv, getReportSummaryForUser } from "@/lib/cars";

export async function GET(request: Request) {
  await ensureAppSetup();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");
  const carIdValue = searchParams.get("carId");
  const filters = {
    carId: carIdValue ? Number(carIdValue) : null,
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo")
  };

  try {
    const summary = await getReportSummaryForUser(user.username, filters);

    if (format === "csv") {
      const csv = buildReportCsv(summary);
      const fileName = buildReportFileName(filters.dateFrom, filters.dateTo, filters.carId);

      return new NextResponse(csv, {
        headers: {
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Content-Type": "text/csv; charset=utf-8"
        }
      });
    }

    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load report.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function buildReportFileName(
  dateFrom: string | null,
  dateTo: string | null,
  carId: number | null
) {
  const scope = carId ? `car-${carId}` : "garage";
  const start = dateFrom ?? "all";
  const end = dateTo ?? "all";
  return `carkeeper-report-${scope}-${start}-to-${end}.csv`;
}
