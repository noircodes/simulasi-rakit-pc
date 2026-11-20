import { isCategoryKey } from "@/lib/categories";
import { lookup } from "@/lib/market/service";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ status: "failed", error: "Body harus JSON." }, { status: 400 });
  }

  const { category, partId, condition, query, peek } = body;
  if (typeof category !== "string" || !isCategoryKey(category) || typeof partId !== "string") {
    return Response.json({ status: "failed", error: "category dan partId wajib diisi." }, { status: 400 });
  }
  if (condition !== "new" && condition !== "used") {
    return Response.json({ status: "failed", error: "condition harus 'new' atau 'used'." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  try {
    const res = await lookup({
      category,
      partId,
      condition,
      query: typeof query === "string" ? query : undefined,
      peek: peek === true,
      ip,
    });
    return Response.json(res, { status: res.status === "limited" ? 429 : 200 });
  } catch (err) {
    console.error("market-price lookup failed", err);
    return Response.json({ status: "failed", error: "Layanan harga Tokopedia sedang bermasalah." }, { status: 502 });
  }
}
