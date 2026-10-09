import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { readImageUrl } from "@/lib/brandCache";
import { familyById } from "@/lib/catalog";
import { priceQuote, sek, type QuoteLine } from "@/lib/pricing";

export type QuoteInput = {
  company: string;
  phone: string;
  brand?: string;
  host?: string;
  lines: { productId: string; qty: number; image?: string }[];
};

const INK = "#111111";
const MUTE = "#6e6e73";
const LINE = "#e5e5ea";
const GREEN = "#1e8e3e";

const TRUST = ["Korrektur innan tryck", "Riktpriser inkl. tryck", "Giltig i 30 dagar"];

async function thumbBuffer(input: { productId: string; image?: string }): Promise<Buffer | null> {
  let raw: Buffer | null = null;
  if (input.image?.startsWith("data:")) {
    const b64 = input.image.split(",", 2)[1];
    if (b64) raw = Buffer.from(b64, "base64");
  } else if (input.image) {
    raw = await readImageUrl(input.image);
  }
  if (!raw) {
    const family = familyById(input.productId);
    if (!family) return null;
    raw = await readFile(path.join(process.cwd(), "public", family.image)).catch(() => null);
  }
  if (!raw) return null;
  // Downscale so the PDF stays small while thumbnails stay crisp.
  return sharp(raw).flatten({ background: "#ffffff" }).resize(240, 240, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer().catch(() => raw);
}

export async function quotePdf(input: QuoteInput): Promise<Buffer> {
  const { lines, total } = priceQuote(input.lines.map((l) => ({ productId: l.productId, qty: l.qty })));
  const thumbs = await Promise.all(input.lines.map((l) => thumbBuffer(l)));
  const thumbById = new Map<string, Buffer | null>();
  input.lines.forEach((l, i) => thumbById.set(l.productId, thumbs[i]));

  const logo = await readFile(path.join(process.cwd(), "public", "PACH_logo.png")).catch(() => null);

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const reference = `PACH-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Header
  if (logo) {
    try {
      doc.image(logo, left, 40, { height: 26 });
    } catch {
      /* ignore */
    }
  } else {
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(18).text("PACH", left, 42);
  }
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(MUTE)
    .text(`Offert ${reference}`, left, 44, { width, align: "right" })
    .text(
      new Date().toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" }),
      left,
      57,
      { width, align: "right" },
    );

  // Title + recipient
  let y = 96;
  doc.fillColor(MUTE).font("Helvetica-Bold").fontSize(8).text("OFFERTFÖRSLAG", left, y);
  y += 14;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(22).text("Profilprodukter med er logotyp", left, y, { width });
  y += 34;

  const info: [string, string][] = [
    ["Kund", input.company || input.brand || "—"],
    ...(input.phone ? ([["Telefon", input.phone]] as [string, string][]) : []),
    ...(input.host ? ([["Webb", input.host]] as [string, string][]) : []),
  ];
  doc.font("Helvetica").fontSize(10);
  for (const [k, v] of info) {
    doc.fillColor(MUTE).text(`${k}  `, left, y, { continued: true }).fillColor(INK).text(v);
    y += 16;
  }
  y += 10;

  // Table header
  const cols = {
    product: left + 54,
    qty: right - 230,
    unit: right - 150,
    sum: right,
  };
  doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTE);
  doc.text("PRODUKT", cols.product, y);
  doc.text("ANTAL", cols.qty, y, { width: 60, align: "right" });
  doc.text("À-PRIS INKL. TRYCK", cols.unit - 40, y, { width: 100, align: "right" });
  doc.text("SUMMA", right - 90, y, { width: 90, align: "right" });
  y += 6;
  doc.moveTo(left, y + 8).lineTo(right, y + 8).strokeColor(LINE).lineWidth(1).stroke();
  y += 16;

  const rowHeight = 46;
  const ensureSpace = (needed: number) => {
    if (y + needed > doc.page.height - 80) {
      doc.addPage();
      y = 50;
    }
  };

  for (const line of lines as QuoteLine[]) {
    ensureSpace(rowHeight);
    const thumb = thumbById.get(line.productId);
    if (thumb) {
      try {
        doc.image(thumb, left, y, { width: 40, height: 40 });
      } catch {
        /* ignore */
      }
    } else {
      doc.roundedRect(left, y, 40, 40, 6).fillColor("#f0f0f2").fill();
    }

    doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(line.name, cols.product, y + 2, { width: cols.qty - cols.product - 10 });
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(MUTE)
      .text(`${line.spec}`, cols.product, y + 17, { width: cols.qty - cols.product - 10 })
      .text(`inkl. tryck · tryckstart ${sek(line.setup)}`, cols.product, y + 28, { width: cols.qty - cols.product - 10 });

    doc.font("Helvetica").fontSize(10).fillColor(INK);
    doc.text(`${line.qty} st`, cols.qty, y + 12, { width: 60, align: "right" });
    doc.text(sek(line.unitInclPrint), cols.unit - 40, y + 12, { width: 100, align: "right" });
    doc.font("Helvetica-Bold").text(sek(line.lineTotal), right - 90, y + 12, { width: 90, align: "right" });

    y += rowHeight;
    doc.moveTo(left, y - 6).lineTo(right, y - 6).strokeColor(LINE).lineWidth(0.5).stroke();
  }

  // Total
  ensureSpace(60);
  y += 8;
  doc.font("Helvetica").fontSize(11).fillColor(MUTE).text("Totalt (exkl. moms)", left, y, { width: width - 120, align: "right" });
  doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text(sek(total), right - 120, y - 3, { width: 120, align: "right" });
  y += 34;

  // Trust row
  ensureSpace(40);
  doc.font("Helvetica").fontSize(9).fillColor(INK);
  let tx = left;
  for (const t of TRUST) {
    doc.fillColor(GREEN).text("• ", tx, y, { continued: true }).fillColor(INK).text(t, { continued: false });
    tx += doc.widthOfString(`•  ${t}`) + 24;
  }
  y += 26;

  // Footer
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(MUTE)
    .text(
      "Priserna är riktpriser och kan variera beroende på antal, design och leveranstid. Moms tillkommer. Offerten är giltig i 30 dagar. Vi återkommer med korrektur och bekräftat leveransdatum.",
      left,
      doc.page.height - 70,
      { width },
    );

  doc.end();
  return done;
}
