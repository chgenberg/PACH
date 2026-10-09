import { campaignCsv, getCampaign } from "@/lib/campaigns";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const c = await getCampaign((await params).token);
  if (!c) return new Response("Hittades inte", { status: 404 });
  return new Response(campaignCsv(c), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${c.kind === "gift" ? "gava-adresser" : "butik-ordrar"}-${c.token.slice(0, 6)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
