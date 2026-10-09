import { readFile } from "node:fs/promises";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { readImageUrl } from "@/lib/brandCache";
import { loadBrand } from "@/lib/brandLogo";
import { familyById, type Family } from "@/lib/catalog";
import { BASE_COLOR, colorName } from "@/lib/colors";
import { estimate, fmtDay } from "@/lib/delivery";
import { isBrandbookHost } from "@/lib/host";
import { colorsOf, type LogoDesign, METHOD_INFO, type Placement, zonesFor } from "@/lib/marking";
import type { StoredQuote, StoredLine } from "@/lib/quoteTypes";
import { analysisLogo } from "@/lib/siteAnalysis";

const DPI = 300;
const UNSET = "Ej angiven";

export type SkuRow = { sku: string; color: string; size: string; qty: number; note?: string };
export type PrintPosition = { file: string; method: string; colors: string; zone: string; widthCm: number; widthPx: number };
export type PoLine = {
  no: number;
  productId: string;
  name: string;
  qty: number;
  color: string;
  rows: SkuRow[];
  positions: PrintPosition[];
  names: { file: string; count: number; zone: string; widthCm: number } | null;
  folder: string;
  readyBy: string;
};
export type PurchaseOrder = { number: string; supplierId: string; supplier: string; lines: PoLine[]; units: number };

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const zoneLabel = (f: Family, id: string) => (id === "egen" ? "Egen placering (se mockup)" : (zonesFor(f).find((z) => z.id === id)?.label ?? id));

const isDarkHex = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 110;
};

/** Size split from the collection link; whatever nobody answered for stays "Ej angiven" until confirmed. */
function sizeSplit(q: StoredQuote, line: StoredLine, f: Family): Map<string, number> {
  const sizes = [...new Set(f.variants.map((v) => v.size))];
  const out = new Map<string, number>();
  if (sizes.length === 1) return out.set(sizes[0], line.qty);
  for (const e of q.collect?.entries ?? []) {
    const s = e.sizes[line.productId];
    if (s && sizes.includes(s)) out.set(s, (out.get(s) ?? 0) + 1);
  }
  let assigned = [...out.values()].reduce((a, b) => a + b, 0);
  // More answers than ordered: trim the largest groups so the order matches the quote.
  while (assigned > line.qty) {
    const [big] = [...out.entries()].sort((a, b) => b[1] - a[1])[0];
    out.set(big, out.get(big)! - 1);
    assigned -= 1;
  }
  if (line.qty > assigned) out.set(UNSET, line.qty - assigned);
  return out;
}

function skuRows(q: StoredQuote, line: StoredLine, f: Family): SkuRow[] {
  const hex = (line.color ?? BASE_COLOR).toUpperCase();
  const byColor = f.variants.filter((v) => v.colorHex.toUpperCase() === hex);
  const variants = byColor.length ? byColor : f.variants.filter((v) => v.colorHex.toUpperCase() === f.variants[0].colorHex.toUpperCase());
  const note = byColor.length ? undefined : `Önskad färg ${colorName(hex)} (${hex}) finns inte som artikel – bekräfta med leverantören`;
  return [...sizeSplit(q, line, f).entries()]
    .filter(([, n]) => n > 0)
    .map(([size, qty]) => {
      const v = variants.find((x) => x.size === size);
      return { sku: v?.sku ?? `${f.id}-?`, color: v?.colorName ?? colorName(hex), size: size === "ONE_SIZE" ? "One size" : size, qty, note: size === UNSET ? "Storlek bekräftas innan beställning" : note };
    });
}

function namesFor(q: StoredQuote, line: StoredLine): { name: string; size: string }[] {
  const fromCollect = (q.collect?.entries ?? []).filter((e) => e.print && e.sizes[line.productId]).map((e) => ({ name: e.print!, size: e.sizes[line.productId] }));
  const fromDesign = (line.design?.names?.list ?? []).map((name) => ({ name, size: "" }));
  return [...fromCollect, ...fromDesign.filter((d) => !fromCollect.some((c) => c.name === d.name))].slice(0, line.qty);
}

type LogoCache = Map<string, Promise<Buffer | null>>;

async function resolveLogo(q: StoredQuote, design: LogoDesign, dark: boolean, brandLogoCache: LogoCache): Promise<Buffer | null> {
  const src = design.logo;
  if (src?.startsWith("data:")) return Buffer.from(src.split(",", 2)[1] ?? "", "base64");
  const host = src?.startsWith("/api/brand-logo") ? decodeURIComponent(new URL(src, "http://x").searchParams.get("host") ?? "") : q.host;
  if (!host) return null;
  const key = `${host}|${dark}`;
  if (!brandLogoCache.has(key)) {
    brandLogoCache.set(
      key,
      loadBrand(host)
        .then(async ({ logo, analysis }) => (await analysisLogo(analysis, dark ? "dark" : "light")) ?? logo)
        .catch(() => null),
    );
  }
  return brandLogoCache.get(key)!;
}

/** Print file at real size: width in cm at 300 dpi, transparent PNG. */
async function printFile(logo: Buffer, widthCm: number): Promise<{ png: Buffer; widthPx: number }> {
  const widthPx = Math.round((widthCm / 2.54) * DPI);
  const png = await sharp(logo, { density: 600 })
    .trim()
    .resize({ width: widthPx, kernel: "lanczos3" })
    .png()
    .withMetadata({ density: DPI })
    .toBuffer();
  return { png, widthPx };
}

async function mockup(line: StoredLine, f: Family): Promise<Buffer | null> {
  let raw: Buffer | null = null;
  if (line.image?.startsWith("data:")) raw = Buffer.from(line.image.split(",", 2)[1] ?? "", "base64");
  else if (line.image) raw = await readImageUrl(line.image);
  raw ??= await readFile(path.join(process.cwd(), "public", f.image)).catch(() => null);
  return raw ? sharp(raw).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer() : null;
}

const csv = (rows: string[][]) => "\uFEFF" + rows.map((r) => r.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";")).join("\r\n");

export async function buildPurchaseOrders(q: StoredQuote): Promise<{ orders: PurchaseOrder[]; files: Record<string, Uint8Array> }> {
  const files: Record<string, Uint8Array> = {};
  const logos: LogoCache = new Map();
  const groups = new Map<string, PoLine[]>();
  const suppliers = new Map<string, string>();
  let no = 0;

  for (const line of q.lines) {
    const f = familyById(line.productId);
    if (!f) continue;
    no += 1;
    const hex = (line.color ?? BASE_COLOR).toUpperCase();
    const folder = `tryckfiler/${String(no).padStart(2, "0")}-${slug(f.name)}`;
    const positions: PrintPosition[] = [];
    const d = line.design;
    if (d) {
      const all: Placement[] = [d, ...(d.extra ?? [])];
      for (const [i, p] of all.entries()) {
        const logo = await resolveLogo(q, { ...p, logo: p.logo ?? d.logo }, isDarkHex(hex), logos);
        const file = `${folder}/position-${i + 1}-${slug(zoneLabel(f, p.zone))}.png`;
        let widthPx = Math.round((p.sizeCm / 2.54) * DPI);
        if (logo) {
          const out = await printFile(logo, p.sizeCm).catch(() => null);
          if (out) {
            files[file] = out.png;
            widthPx = out.widthPx;
          }
        }
        const colors = p.method === "digitaltryck" ? "Fyrfärg (CMYK)" : p.method === "gravyr" ? "Ton i ton" : `${colorsOf(p)} färg${colorsOf(p) === 1 ? "" : "er"}`;
        positions.push({ file: files[file] ? file : "(logga saknas – hämtas vid korrektur)", method: METHOD_INFO[p.method].label, colors, zone: zoneLabel(f, p.zone), widthCm: p.sizeCm, widthPx });
      }
    }
    const nameRows = namesFor(q, line);
    let names: PoLine["names"] = null;
    if (nameRows.length && d?.names) {
      const file = `${folder}/namn.csv`;
      files[file] = strToU8(csv([["Nr", "Namn", "Storlek"], ...nameRows.map((r, i) => [String(i + 1), r.name, r.size])]));
      names = { file, count: nameRows.length, zone: zoneLabel(f, d.names.zone), widthCm: d.names.sizeCm };
    }
    const shot = await mockup(line, f);
    if (shot) files[`${folder}/mockup.jpg`] = shot;
    files[`${folder}/spec.json`] = strToU8(
      JSON.stringify({ product: f.name, productId: f.id, color: colorName(hex), qty: line.qty, positions, names, dpi: DPI }, null, 2),
    );

    const po: PoLine = {
      no,
      productId: f.id,
      name: f.name,
      qty: line.qty,
      color: colorName(hex),
      rows: skuRows(q, line, f),
      positions,
      names,
      folder,
      readyBy: estimate(f, d).date,
    };
    suppliers.set(f.supplierId, f.brand);
    groups.set(f.supplierId, [...(groups.get(f.supplierId) ?? []), po]);
  }

  const orders: PurchaseOrder[] = [...groups.entries()].map(([supplierId, lines], i) => ({
    number: `${q.ref.replace("PACH", "PO")}-${i + 1}`,
    supplierId,
    supplier: suppliers.get(supplierId) ?? supplierId,
    lines,
    units: lines.reduce((s, l) => s + l.qty, 0),
  }));

  for (const o of orders) files[`${o.number}-${slug(o.supplier)}.pdf`] = new Uint8Array(await poPdf(q, o));
  files["artiklar.csv"] = strToU8(
    csv([
      ["Inköpsorder", "Leverantör", "Artikelnr", "Produkt", "Färg", "Storlek", "Antal", "Anmärkning"],
      ...orders.flatMap((o) => o.lines.flatMap((l) => l.rows.map((r) => [o.number, o.supplier, r.sku, l.name, r.color, r.size, String(r.qty), r.note ?? ""]))),
    ]),
  );
  return { orders, files };
}

export async function purchaseOrderZip(q: StoredQuote): Promise<{ zip: Uint8Array; orders: PurchaseOrder[] }> {
  const { orders, files } = await buildPurchaseOrders(q);
  return { zip: zipSync(files, { level: 6 }), orders };
}

const INK = "#111111";
const MUTE = "#6e6e73";
const LINE = "#e5e5ea";

function poPdf(q: StoredQuote, o: PurchaseOrder): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Inköpsorder ${o.number}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const W = doc.page.width - 96;

    doc.font("Helvetica-Bold").fontSize(20).fillColor(INK).text("Inköpsorder", 48, 48);
    doc.font("Helvetica").fontSize(10).fillColor(MUTE).text(`${o.number} · ${new Date().toLocaleDateString("sv-SE")}`, 48, 52, { width: W, align: "right" });
    doc.moveDown(1.2);
    const info: [string, string][] = [
      ["Leverantör", `${o.supplier} (${o.supplierId})`],
      ["Kund", q.company + (q.brand && !isBrandbookHost(q.host ?? "") ? ` · ${q.brand}` : "")],
      ["Kundorder", q.ref],
      ["Leverans senast", q.eventDate ? fmtDay(q.eventDate) : `ca ${fmtDay(o.lines.reduce((a, l) => (l.readyBy > a ? l.readyBy : a), ""))}`],
      ["Antal artiklar", `${o.units} st`],
    ];
    for (const [k, v] of info) {
      const y = doc.y;
      doc.font("Helvetica").fontSize(9.5).fillColor(MUTE).text(k, 48, y, { width: 110 });
      doc.font("Helvetica-Bold").fillColor(INK).text(v, 160, y, { width: W - 112 });
      doc.moveDown(0.25);
    }
    doc.moveDown(0.8);

    for (const l of o.lines) {
      if (doc.y > doc.page.height - 220) doc.addPage();
      doc.moveTo(48, doc.y).lineTo(48 + W, doc.y).strokeColor(LINE).lineWidth(1).stroke();
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(`${l.no}. ${l.name}`, 48, doc.y, { continued: true });
      doc.font("Helvetica").fontSize(10).fillColor(MUTE).text(`   ${l.qty} st · ${l.color}`);
      doc.moveDown(0.4);

      const cols = [48, 190, 290, 350, 410];
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTE);
      ["ARTIKELNR", "FÄRG", "STORLEK", "ANTAL", "ANMÄRKNING"].forEach((h, i) => doc.text(h, cols[i], doc.y, { lineBreak: false }));
      doc.moveDown(0.9);
      for (const r of l.rows) {
        const y = doc.y;
        doc.font("Helvetica").fontSize(9.5).fillColor(INK);
        doc.text(r.sku, cols[0], y, { lineBreak: false });
        doc.text(r.color, cols[1], y, { lineBreak: false });
        doc.text(r.size, cols[2], y, { lineBreak: false });
        doc.font("Helvetica-Bold").text(String(r.qty), cols[3], y, { lineBreak: false });
        doc.font("Helvetica").fontSize(8.5).fillColor(MUTE).text(r.note ?? "", cols[4], y, { width: 48 + W - cols[4] });
        doc.y = Math.max(doc.y, y + 14);
      }
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text("Märkning", 48, doc.y, { width: W });
      if (!l.positions.length) doc.font("Helvetica").fontSize(9.5).fillColor(MUTE).text("Standardmärkning enligt korrektur.", 48, doc.y, { width: W });
      for (const [i, p] of l.positions.entries()) {
        doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(`Position ${i + 1}: ${p.method}, ${p.colors}, ${p.zone}, ${p.widthCm} cm bred`, 48, doc.y, { width: W });
        doc.fontSize(8.5).fillColor(MUTE).text(`Fil: ${p.file} (${p.widthPx} px @ ${DPI} dpi)`, 48, doc.y, { width: W });
      }
      if (l.names) {
        doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(`Namntryck: ${l.names.count} namn, ${l.names.zone}, ${l.names.widthCm} cm bred`, 48, doc.y, { width: W });
        doc.fontSize(8.5).fillColor(MUTE).text(`Namnlista: ${l.names.file}`, 48, doc.y, { width: W });
      }
      doc.fontSize(8.5).fillColor(MUTE).text(`Mockup och specifikation: ${l.folder}/`, 48, doc.y, { width: W });
      doc.moveDown(0.9);
    }

    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTE).text(
      "Inköpspris enligt gällande avtal med leverantören. Tryck sker först efter godkänt korrektur. Tryckfilerna är rasterfiler i skala 1:1 vid 300 dpi – begär vektorfil från kunden om metoden kräver det.",
      48,
      doc.y,
      { width: W },
    );
    doc.end();
  });
}
