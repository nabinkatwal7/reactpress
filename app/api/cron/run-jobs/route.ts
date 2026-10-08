import { runDueJobs } from "@/lib/jobs";
import { NextResponse } from "next/server";

/** Hit from a cron/scheduler: `Authorization: Bearer $CRON_SECRET`. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runDueJobs());
}
