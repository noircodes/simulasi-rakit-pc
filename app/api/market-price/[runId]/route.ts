import { connection } from "next/server";
import { pollRun } from "@/lib/market/service";

export async function GET(_req: Request, ctx: RouteContext<"/api/market-price/[runId]">) {
  await connection();
  const { runId } = await ctx.params;
  if (!/^[A-Za-z0-9]{8,32}$/.test(runId)) {
    return Response.json({ status: "failed", error: "runId tidak valid." }, { status: 400 });
  }
  try {
    const res = await pollRun(runId);
    if (!res) return Response.json({ status: "failed", error: "Run tidak dikenal atau sudah kedaluwarsa." }, { status: 404 });
    return Response.json(res);
  } catch (err) {
    console.error("market-price poll failed", err);
    return Response.json({ status: "failed", error: "Gagal membaca status pencarian Tokopedia." }, { status: 502 });
  }
}
