import { readImage } from "@/lib/brandCache";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const img = await readImage((await params).id);
  if (!img) return new Response("Hittades inte", { status: 404 });
  return new Response(new Uint8Array(img), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
