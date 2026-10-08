import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "reactpress",
    time: new Date().toISOString(),
  });
}
