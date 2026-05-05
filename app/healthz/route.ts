import { pingDatabase } from "@/lib/mongodb";

export async function GET() {
  try {
    await pingDatabase();
    return Response.json({ status: "ok", database: "reachable" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Health check failed.";
    return Response.json({ status: "error", database: "unreachable", error: message }, { status: 503 });
  }
}
