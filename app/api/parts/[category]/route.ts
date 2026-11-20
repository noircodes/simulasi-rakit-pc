import { CATEGORY_KEYS, isCategoryKey } from "@/lib/categories";
import { catalogMeta, getCatalog } from "@/lib/server-data";

export async function generateStaticParams() {
  return CATEGORY_KEYS.map((category) => ({ category }));
}

export async function GET(_req: Request, ctx: RouteContext<"/api/parts/[category]">) {
  const { category } = await ctx.params;
  if (!isCategoryKey(category)) {
    return Response.json({ error: `Kategori tidak dikenal: ${category}` }, { status: 404 });
  }
  const parts = await getCatalog(category);
  return Response.json({
    category,
    count: parts.length,
    source: catalogMeta.source,
    license: catalogMeta.license,
    syncedAt: catalogMeta.syncedAt,
    parts,
  });
}
