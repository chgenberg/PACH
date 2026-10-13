import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { cacheKey, cachedUrl, readImageUrl } from "@/lib/brandCache";
import { familyById } from "@/lib/catalog";
import { BASE_COLOR, colorName, isHex } from "@/lib/colors";
import { estimate, fmtDay, methodLabel } from "@/lib/delivery";
import { isBrandbookHost, normalizeHost } from "@/lib/host";
import { designSummary, placementRows, sanitizeDesign } from "@/lib/marking";
import { readSeller } from "@/lib/offerSettings";
import { DEFAULT_PRESENTATION, initials, type Presentation, type SellerProfile } from "@/lib/offerTemplates";
import { priceQuote, sek, type QuoteLine } from "@/lib/pricing";
import { sanitizeProofs } from "@/lib/quoteTypes";
import { newRef } from "@/lib/quotes";
import { coverFor } from "@/lib/share";
import { analysisLogo, brandRev, readAnalysis } from "@/lib/siteAnalysis";
import { readTerms } from "@/lib/terms";

export type QuoteInput = {
  company: string;
  phone: string;
  brand?: string;
  host?: string;
  lines: { productId: string; qty: number; image?: string; color?: string; design?: unknown; proofs?: unknown; price?: { unit: number; setup: number } }[];
  extras?: { label: string; amount: number }[];
  reference?: string;
  createdAt?: string;
  eventDate?: string;
};

export type PdfOptions = { presentation?: Presentation; seller?: SellerProfile | null };

const INK = "#111111";
const MUTE = "#6e6e73";
const LINE = "#e5e5ea";
const SOFT = "#f4f4f6";
const GREEN = "#1e8e3e";
const CLAY = "#8d3d2c";

const fromDataUrl = (v: string) => {
  const b64 = v.split(",", 2)[1];
  return b64 ? Buffer.from(b64, "base64") : null;
};

async function rawImage(input: { productId: string; image?: string }): Promise<Buffer | null> {
  let raw: Buffer | null = null;
  if (input.image?.startsWith("data:")) raw = fromDataUrl(input.image);
  else if (input.image) raw = await readImageUrl(input.image);
  if (!raw) {
    const family = familyById(input.productId);
    if (!family) return null;
    raw = await readFile(path.join(process.cwd(), "public", family.image)).catch(() => null);
  }
  return raw;
}

/** Whole product visible: fit inside the square instead of cropping it. */
const fitted = (raw: Buffer, size: number, quality = 82) =>
  sharp(raw)
    .flatten({ background: "#ffffff" })
    .resize(size, size, { fit: "contain", background: "#ffffff" })
    .jpeg({ quality })
    .toBuffer()
    .catch(() => null);

/** The customer's own logo: the verified one from the site analysis, else an uploaded logo from the design. */
async function customerLogo(input: QuoteInput): Promise<Buffer | null> {
  let raw: Buffer | null = null;
  if (input.host) raw = await analysisLogo(await readAnalysis(input.host).catch(() => null)).catch(() => null);
  if (!raw) {
    const uploaded = input.lines.map((l) => (l.design as { logo?: unknown } | undefined)?.logo).find((v): v is string => typeof v === "string" && v.startsWith("data:image/"));
    if (uploaded) raw = fromDataUrl(uploaded);
  }
  if (!raw) return null;
  return sharp(raw).flatten({ background: "#ffffff" }).trim({ threshold: 12 }).resize(600, 240, { fit: "inside" }).png().toBuffer().catch(() => null);
}

/** The customer's branded product photo, if one has been made – for lines that only have the catalogue photo. */
async function brandedPhoto(host: string | undefined, productId: string): Promise<string | undefined> {
  if (!host) return undefined;
  const h = normalizeHost(host);
  return (await cachedUrl(cacheKey("product-v3", h, String(await brandRev(h)), productId)).catch(() => null)) ?? undefined;
}

const COVER = { w: 515, h: 230 };
const CONTACT_W = 240;

async function coverImage(host: string | undefined): Promise<Buffer | null> {
  const url = await coverFor(host);
  const raw = url ? await readImageUrl(url) : null;
  return raw ? sharp(raw).resize(COVER.w * 2, COVER.h * 2, { fit: "cover" }).jpeg({ quality: 84 }).toBuffer().catch(() => null) : null;
}

export async function quotePdf(input: QuoteInput, opts: PdfOptions = {}): Promise<Buffer> {
  const pres = opts.presentation ?? DEFAULT_PRESENTATION;
  const { show, layout } = pres;
  const terms = await readTerms();
  const seller = show.contact ? (opts.seller !== undefined ? opts.seller : await readSeller()) : null;
  input = {
    ...input,
    lines: await Promise.all(
      input.lines.map(async (l) => (l.image && l.image !== familyById(l.productId)?.image ? l : { ...l, image: (await brandedPhoto(input.host, l.productId)) ?? l.image })),
    ),
  };
  const { lines, total: linesTotal } = priceQuote(input.lines.map((l) => ({ productId: l.productId, qty: l.qty, design: l.design, price: l.price })));
  const extras = (input.extras ?? []).filter((e) => e.label);
  const total = linesTotal + extras.reduce((s, e) => s + e.amount, 0);
  const detail = new Map(
    input.lines.map((l) => {
      const family = familyById(l.productId);
      const design = family ? sanitizeDesign(family, l.design) : undefined;
      return [
        l.productId,
        {
          family,
          design,
          summary: family && design ? designSummary(family, design) : null,
          rows: family && design ? placementRows(family, design) : [],
          delivery: family ? estimate(family, design) : null,
          color: colorName(isHex(l.color) ? l.color : BASE_COLOR),
          proofs: sanitizeProofs(l.proofs) ?? [],
        },
      ] as const;
    }),
  );
  const lastDelivery = [...detail.values()].map((d) => d.delivery?.date ?? "").reduce((a, b) => (b > a ? b : a), "");
  const raws = await Promise.all(input.lines.map((l) => rawImage(l)));
  const thumbs = new Map<string, Buffer | null>();
  const heroes = new Map<string, Buffer | null>();
  await Promise.all(
    input.lines.map(async (l, i) => {
      const raw = raws[i];
      thumbs.set(l.productId, raw ? await fitted(raw, 240, 80) : null);
      heroes.set(l.productId, raw ? await fitted(raw, 1000, 86) : null);
    }),
  );

  const [logoRaw, clientRaw, coverRaw, photoRaw] = await Promise.all([
    readFile(path.join(process.cwd(), "public", "PACH_logo.png"))
      .then((b) => sharp(b).resize({ width: 480 }).png().toBuffer())
      .catch(() => null),
    customerLogo(input),
    layout === "bildfokus" && show.cover ? coverImage(input.host) : null,
    seller?.photo ? sharp(fromDataUrl(seller.photo) ?? Buffer.alloc(0)).resize(200, 200, { fit: "cover" }).jpeg({ quality: 86 }).toBuffer().catch(() => null) : null,
  ]);

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  // Embedded once and reused on every page; openImage exists in pdfkit but is missing from its types.
  type ImageSrc = Parameters<typeof doc.image>[0];
  const open = (b: Buffer | null): ImageSrc | null => {
    if (!b) return null;
    try {
      return (doc as unknown as { openImage: (src: Buffer) => ImageSrc }).openImage(b);
    } catch {
      return null;
    }
  };
  const img = (src: ImageSrc | Buffer | null | undefined, x: number, y: number, o: PDFKit.Mixins.ImageOption) => {
    if (!src) return;
    try {
      doc.image(src, x, y, o);
    } catch {
      /* ignore */
    }
  };
  const logo = open(logoRaw);
  const client = open(clientRaw);
  const photo = open(photoRaw);
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const bottom = doc.page.height - 80;
  const reference = input.reference ?? newRef();
  const issued = input.createdAt ? new Date(input.createdAt) : new Date();
  const customer = input.company || input.brand || "—";

  const header = (label: string) => {
    if (logo) img(logo, left, 40, { height: 26 });
    else doc.fillColor(INK).font("Helvetica-Bold").fontSize(18).text("PACH", left, 42);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTE)
      .text(label, left, 44, { width, align: "right" })
      .text(issued.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" }), left, 57, { width, align: "right" });
  };

  const footer = (text: string) => {
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTE).text(text, left, doc.page.height - 70, { width });
  };

  /** Photo or initials, name, title and contact details; returns the bottom edge. */
  const contactCard = (x: number, top: number, w: number) => {
    if (!seller) return top;
    const h = 64;
    doc.roundedRect(x, top, w, h, 12).strokeColor(LINE).lineWidth(1).stroke();
    const cx = x + 16 + 20;
    const cy = top + h / 2;
    if (photo) {
      doc.save();
      doc.circle(cx, cy, 20).clip();
      img(photo, cx - 20, cy - 20, { width: 40, height: 40 });
      doc.restore();
    } else {
      doc.circle(cx, cy, 20).fillColor(INK).fill();
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#ffffff").text(initials(seller.name), cx - 20, cy - 6, { width: 40, align: "center" });
    }
    const sx = x + 72;
    const tw = w - 84;
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTE).text("DIN KONTAKTPERSON", sx, top + 12);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(`${seller.name}${seller.title ? `, ${seller.title.toLowerCase()}` : ""}`, sx, top + 24, { width: tw, height: 13, ellipsis: true });
    doc.font("Helvetica").fontSize(9).fillColor(MUTE).text([seller.email, seller.phone].filter(Boolean).join("  ·  "), sx, top + 40, { width: tw, height: 11, ellipsis: true });
    return top + h;
  };

  let y = 0;
  const ensureSpace = (needed: number) => {
    if (y + needed > bottom) {
      doc.addPage();
      y = 50;
    }
  };

  header(`Offert ${reference}`);
  y = 92;

  // Cover: the customer's branded scene, else the products side by side
  if (layout === "bildfokus" && show.cover) {
    doc.save();
    doc.roundedRect(left, y, COVER.w, COVER.h, 16).clip();
    if (coverRaw) img(coverRaw, left, y, { width: COVER.w, height: COVER.h });
    else {
      const shown = lines.slice(0, 3);
      const cw = COVER.w / Math.max(1, shown.length);
      shown.forEach((l, i) => img(heroes.get(l.productId), left + i * cw + 12, y + 16, { fit: [cw - 24, COVER.h - 32], align: "center", valign: "center" }));
    }
    doc.restore();
    if (!coverRaw) doc.roundedRect(left, y, COVER.w, COVER.h, 16).strokeColor(LINE).lineWidth(1).stroke();
    y += COVER.h + 22;
  }

  // Title + recipient, with the customer's logo on the right
  const top = y;
  const logoBox = { w: 150, h: 64 };
  if (client) {
    doc.roundedRect(right - logoBox.w, y, logoBox.w, logoBox.h, 10).strokeColor(LINE).lineWidth(1).stroke();
    img(client, right - logoBox.w + 14, y + 10, { fit: [logoBox.w - 28, logoBox.h - 20], align: "center", valign: "center" });
  }
  const textWidth = client ? width - logoBox.w - 20 : width;
  doc.fillColor(MUTE).font("Helvetica-Bold").fontSize(8).text("OFFERTFÖRSLAG", left, y);
  y += 14;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(22).text(input.brand ? `Profilprodukter för ${input.brand}` : "Profilprodukter med er logotyp", left, y, { width: textWidth });
  y = doc.y + 6;
  if (pres.intro) {
    doc.font("Helvetica").fontSize(10.5).fillColor(MUTE).text(pres.intro, left, y, { width: textWidth, lineGap: 2 });
    y = doc.y + 8;
  }
  y = Math.max(y + 4, client ? top + logoBox.h + 12 : 0);

  // The showcase keeps the contact person up here, beside the customer details, so one page holds it all.
  const contactBeside = layout === "bildfokus" && Boolean(seller);
  const info: [string, string][] = [
    ["Kund", customer],
    ...(input.phone ? ([["Telefon", input.phone]] as [string, string][]) : []),
    ...(input.host && !isBrandbookHost(input.host) ? ([["Webb", input.host]] as [string, string][]) : []),
    ...(input.eventDate ? ([["Behövs senast", fmtDay(input.eventDate)]] as [string, string][]) : []),
    ...(show.delivery && lastDelivery ? ([["Beräknad leverans", `senast ca ${fmtDay(lastDelivery)}${contactBeside ? "" : " vid beställning i dag"}`]] as [string, string][]) : []),
  ];
  const infoTop = y;
  const infoWidth = contactBeside ? width - CONTACT_W - 16 : width;
  doc.font("Helvetica").fontSize(10);
  for (const [k, v] of info) {
    doc.fillColor(MUTE).text(`${k}  `, left, y, { continued: true, width: infoWidth }).fillColor(INK).text(v);
    y += 16;
  }
  if (contactBeside) y = Math.max(y, contactCard(right - CONTACT_W, infoTop - 4, CONTACT_W) + 4);
  y += 10;

  if (layout === "bildfokus") {
    // Large product cards: two per row, three when there are many
    const perRow = lines.length >= 3 ? 3 : 2;
    const gap = 16;
    const cw = (width - gap * (perRow - 1)) / perRow;
    const imgH = perRow === 3 ? 130 : 150;
    const textLines = 2 + (show.prices ? 1 : 0) + (show.delivery ? 1 : 0) + (show.printSpec ? 1 : 0);
    const cardH = imgH + 14 + textLines * 13 + 10;
    (lines as QuoteLine[]).forEach((line, i) => {
      const col = i % perRow;
      if (col === 0) ensureSpace(cardH);
      const x = left + col * (cw + gap);
      const d = detail.get(line.productId);
      const proof = d?.proofs[0] ? fromDataUrl(d.proofs[0].image) : null;
      doc.roundedRect(x, y, cw, imgH, 12).strokeColor(LINE).lineWidth(1).stroke();
      img(proof ?? heroes.get(line.productId), x + 10, y + 10, { fit: [cw - 20, imgH - 20], align: "center", valign: "center" });
      let ty = y + imgH + 10;
      doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(line.name, x, ty, { width: cw, height: 13, ellipsis: true });
      ty += 14;
      doc.font("Helvetica").fontSize(8.5).fillColor(MUTE).text(`${line.qty} st · ${d?.color ?? ""} · ${line.spec}`, x, ty, { width: cw, height: 11, ellipsis: true });
      ty += 13;
      if (show.printSpec) {
        doc.text(d?.summary ?? "Tryck med er logga", x, ty, { width: cw, height: 11, ellipsis: true });
        ty += 13;
      }
      if (show.delivery && d?.delivery) {
        doc.text(`Leverans ca ${fmtDay(d.delivery.date)}`, x, ty, { width: cw, height: 11, ellipsis: true });
        ty += 13;
      }
      if (show.prices) {
        doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(sek(line.lineTotal), x, ty, { width: cw, continued: show.unitPrices });
        if (show.unitPrices) doc.font("Helvetica").fontSize(8.5).fillColor(MUTE).text(`  ·  ${sek(line.unitInclPrint)}/st inkl. tryck`);
      }
      if (col === perRow - 1 || i === lines.length - 1) y += cardH;
    });
  } else {
    // Table: the compact layout drops the detail lines and, unless asked for, the unit price
    const compact = layout === "kompakt";
    const cols = show.unitPrices ? { qty: right - 230, unit: right - 150 } : show.prices ? { qty: right - 160, unit: 0 } : { qty: right - 60, unit: 0 };
    const product = left + 54;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTE);
    doc.text("PRODUKT", product, y);
    doc.text("ANTAL", cols.qty, y, { width: 60, align: "right" });
    if (show.unitPrices) doc.text("À-PRIS INKL. TRYCK", cols.unit - 40, y, { width: 100, align: "right" });
    if (show.prices) doc.text("SUMMA", right - 90, y, { width: 90, align: "right" });
    y += 6;
    doc.moveTo(left, y + 8).lineTo(right, y + 8).strokeColor(LINE).lineWidth(1).stroke();
    y += 16;

    for (const line of lines as QuoteLine[]) {
      const d = detail.get(line.productId);
      const sub: string[] = [];
      if (!compact) {
        if (show.printSpec) {
          if (d?.rows.length) for (const r of d.rows) sub.push(`${r.label}: ${r.zone} · ${r.method} · ${r.colors} · ${r.size}`);
          else sub.push(d?.summary ?? "Tryck med er logga");
        }
        const meta = [show.unitPrices ? `Startkostnad märkning ${sek(line.setup)}` : "", show.delivery && d?.delivery ? `leverans ca ${fmtDay(d.delivery.date)}` : ""].filter(Boolean).join(" · ");
        if (meta) sub.push(meta.charAt(0).toUpperCase() + meta.slice(1));
      }
      const thumbSize = compact ? 32 : 40;
      const rowHeight = Math.max(compact ? 42 : 58, 30 + sub.length * 11 + 14);
      ensureSpace(rowHeight);
      const thumb = thumbs.get(line.productId);
      if (thumb) img(thumb, left, y, { width: thumbSize, height: thumbSize });
      else doc.roundedRect(left, y, thumbSize, thumbSize, 6).fillColor("#f0f0f2").fill();
      const w = cols.qty - product - 10;
      doc.font("Helvetica-Bold").fontSize(compact ? 10.5 : 11).fillColor(INK).text(line.name, product, y + 2, { width: w, height: 13, ellipsis: true });
      doc.font("Helvetica").fontSize(8.5).fillColor(MUTE).text(`${line.spec} · ${d?.color ?? ""}`, product, y + 16, { width: w, height: 10, ellipsis: true });
      sub.forEach((s, i) => doc.text(s, product, y + 28 + i * 11, { width: w, height: 10, ellipsis: true }));

      const ry = compact ? y + 8 : y + 12;
      doc.font("Helvetica").fontSize(10).fillColor(INK);
      doc.text(`${line.qty} st`, cols.qty, ry, { width: 60, align: "right" });
      if (show.unitPrices) doc.text(sek(line.unitInclPrint), cols.unit - 40, ry, { width: 100, align: "right" });
      if (show.prices) doc.font("Helvetica-Bold").text(sek(line.lineTotal), right - 90, ry, { width: 90, align: "right" });

      y += rowHeight;
      doc.moveTo(left, y - 6).lineTo(right, y - 6).strokeColor(LINE).lineWidth(0.5).stroke();
    }
  }

  // Freight, express and other free lines
  if (extras.length) {
    if (layout === "bildfokus") y += 6;
    for (const e of extras) {
      ensureSpace(26);
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(INK).text(e.label, layout === "bildfokus" ? left : left + 54, y + 2, { width: width - 160 });
      if (show.prices) doc.font("Helvetica-Bold").fontSize(10).text(sek(e.amount), right - 90, y + 2, { width: 90, align: "right" });
      y += 24;
      doc.moveTo(left, y - 6).lineTo(right, y - 6).strokeColor(LINE).lineWidth(0.5).stroke();
    }
  }

  if (show.prices) {
    ensureSpace(60);
    y += 8;
    doc.font("Helvetica").fontSize(11).fillColor(MUTE).text("Totalt (exkl. moms)", left, y, { width: width - 120, align: "right" });
    doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text(sek(total), right - 120, y - 3, { width: 120, align: "right" });
    y += 24;
    if (show.vat) {
      doc.font("Helvetica").fontSize(9).fillColor(MUTE).text(`Inkl. moms ${terms.vatPct} %: ${sek(Math.round(total * (1 + terms.vatPct / 100)))}`, left, y, { width, align: "right" });
      y += 14;
    }
    y += 8;
  } else {
    ensureSpace(30);
    y += 6;
    doc.font("Helvetica").fontSize(9.5).fillColor(MUTE).text(seller?.name ? `Priser tar ${seller.name.split(" ")[0]} fram när ni har bestämt er för upplägget.` : "Priser tar vi fram när ni har bestämt er för upplägget.", left, y, { width });
    y = doc.y + 14;
  }

  // Trust row – a price-less showcase already says what comes next in the note above
  if (show.prices || layout !== "bildfokus") {
    const trust = ["Korrektur innan tryck", ...(show.prices ? ["Riktpriser inkl. tryck"] : []), ...(show.terms ? [`Giltig i ${terms.validDays} dagar`] : [])];
    ensureSpace(24);
    doc.font("Helvetica").fontSize(9).fillColor(INK);
    let tx = left;
    for (const t of trust) {
      doc.fillColor(GREEN).text("• ", tx, y, { continued: true }).fillColor(INK).text(t, { continued: false });
      tx += doc.widthOfString(`•  ${t}`) + 24;
    }
    y += 20;
  }
  if (show.proofs) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTE).text(`3D-korrektur för varje produkt finns på följande ${lines.length === 1 ? "sida" : `${lines.length} sidor`}.`, left, y, { width });
    y += 18;
  }

  if (show.terms) {
    ensureSpace(50);
    doc.roundedRect(left, y, width, 40, 10).fillColor(SOFT).fill();
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("Villkor", left + 14, y + 9);
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(MUTE)
      .text(`Offerten gäller i ${terms.validDays} dagar · betalning ${terms.paymentDays} dagar netto · moms ${terms.vatPct} % tillkommer · ordern binds när offert och korrektur är godkända.`, left + 14, y + 22, { width: width - 28, height: 11, ellipsis: true });
    y += 52;
  }

  if (seller && !contactBeside) {
    ensureSpace(76);
    y = contactCard(left, y, width) + 12;
  }

  footer(
    show.terms
      ? `Priserna är riktpriser och kan variera beroende på antal, design och leveranstid. Moms ${terms.vatPct} % tillkommer. Offerten är giltig i ${terms.validDays} dagar och betalvillkoren är ${terms.paymentDays} dagar netto. Ordern blir bindande först när ni godkänt offert och korrektur.`
      : "Ordern blir bindande först när ni godkänt offert och korrektur.",
  );

  // One proof page per product
  if (show.proofs)
    (lines as QuoteLine[]).forEach((line, index) => {
      const d = detail.get(line.productId);
      if (!d?.family) return;
      doc.addPage();
      header(`Korrektur ${index + 1} av ${lines.length} · Offert ${reference}`);

      let py = 92;
      doc.fillColor(CLAY).font("Helvetica-Bold").fontSize(8).text("3D-KORREKTUR", left, py);
      py += 13;
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(20).text(line.name, left, py, { width: width - 160 });
      if (client) img(client, right - 120, py - 10, { fit: [120, 34], align: "right", valign: "center" });
      py = doc.y + 2;
      doc.font("Helvetica").fontSize(10).fillColor(MUTE).text(`${line.qty} st · ${d.color} · ${line.spec}`, left, py, { width });
      py = doc.y + 12;

      const proofImgs = d.proofs.flatMap((p) => {
        const buf = fromDataUrl(p.image);
        return buf ? [{ label: p.label, buf }] : [];
      });
      const hero = proofImgs[0]?.buf ?? heroes.get(line.productId) ?? null;
      const nameRows = show.printSpec ? Math.ceil(Math.min(40, d.design?.names?.list.length ?? 0) / 4) : 0;
      const heroH = Math.max(190, (proofImgs.length > 1 ? 270 : 340) - nameRows * 11 - (show.printSpec ? (d.design?.extra?.length ?? 0) * 8 : -60));
      doc.roundedRect(left, py, width, heroH, 14).fillColor(SOFT).fill();
      img(hero, left + 10, py + 10, { fit: [width - 20, heroH - 20], align: "center", valign: "center" });
      if (proofImgs[0]) {
        doc.font("Helvetica-Bold").fontSize(8).fillColor(INK).text(proofImgs[0].label.toUpperCase(), left + 14, py + heroH - 22);
      } else if (!d.design) {
        doc.font("Helvetica").fontSize(8.5).fillColor(MUTE).text("Standardplacering – vi skickar en exakt skiss innan tryck.", left + 14, py + heroH - 22);
      }
      py += heroH + 10;

      const rest = proofImgs.slice(1);
      if (rest.length) {
        const gap = 10;
        const cw = (width - gap * (rest.length - 1)) / rest.length;
        const ch = nameRows ? 108 : 120;
        rest.forEach((p, i) => {
          const x = left + i * (cw + gap);
          doc.roundedRect(x, py, cw, ch, 10).fillColor(SOFT).fill();
          img(p.buf, x + 6, py + 6, { fit: [cw - 12, ch - 24], align: "center", valign: "center" });
          doc.font("Helvetica-Bold").fontSize(7.5).fillColor(INK).text(p.label.toUpperCase(), x + 10, py + ch - 14, { width: cw - 20, height: 9, ellipsis: true });
        });
        py += ch + 14;
      }

      if (show.printSpec) {
        // Specification per print position
        const spec = { pos: left, zone: left + 90, method: left + 210, colors: left + 310, size: left + 390, shape: left + 460 };
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTE);
        doc.text("TRYCK", spec.pos, py);
        doc.text("PLACERING", spec.zone, py);
        doc.text("METOD", spec.method, py);
        doc.text("FÄRGER", spec.colors, py);
        doc.text("STORLEK", spec.size, py);
        doc.text("FORM", spec.shape, py);
        py += 12;
        doc.moveTo(left, py).lineTo(right, py).strokeColor(LINE).lineWidth(0.8).stroke();
        py += 6;
        const shown = d.rows.length
          ? d.rows
          : [{ label: "Logga", zone: "Standard", method: d.delivery ? methodLabel(d.delivery.method) : "—", colors: "1 färg", size: "Enligt skiss", shape: "Original" }];
        for (const r of shown) {
          doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(r.label, spec.pos, py, { width: 85 });
          doc.font("Helvetica").fontSize(9).fillColor(INK);
          doc.text(r.zone, spec.zone, py, { width: 115, height: 11, ellipsis: true });
          doc.text(r.method, spec.method, py, { width: 95 });
          doc.text(r.colors, spec.colors, py, { width: 75 });
          doc.text(r.size, spec.size, py, { width: 70 });
          doc.text(r.shape, spec.shape, py, { width: right - spec.shape });
          py += 16;
          doc.moveTo(left, py - 3).lineTo(right, py - 3).strokeColor(LINE).lineWidth(0.4).stroke();
        }
        py += 6;

        // Personalised names
        const names = d.design?.names?.list ?? [];
        if (names.length) {
          doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(`Namntryck · ${names.length} st`, left, py);
          py += 13;
          const colsN = 4;
          const shownNames = names.slice(0, 40);
          const cw = width / colsN;
          shownNames.forEach((n, i) => {
            const cx = left + (i % colsN) * cw;
            const cy = py + Math.floor(i / colsN) * 11;
            doc.font("Helvetica").fontSize(8).fillColor(INK).text(`${i + 1}. ${n}`, cx, cy, { width: cw - 8, height: 10, ellipsis: true });
          });
          py += Math.ceil(shownNames.length / colsN) * 11 + 4;
          if (names.length > shownNames.length) {
            doc.font("Helvetica").fontSize(8).fillColor(MUTE).text(`+ ${names.length - shownNames.length} namn till – hela listan följer med i ordern.`, left, py);
            py += 12;
          }
          py += 6;
        }
      }

      if (show.delivery && d.delivery) {
        doc.font("Helvetica").fontSize(9).fillColor(MUTE).text(`Beräknad leverans ca ${fmtDay(d.delivery.date)} (${d.delivery.days} arbetsdagar från godkänt korrektur, ${methodLabel(d.delivery.method).toLowerCase()}).`, left, py, { width });
        py = doc.y + 10;
      }

      // Approval box, right under the content; a very long spec gets its own page for it.
      if (py + 74 > doc.page.height - 78) {
        doc.addPage();
        header(`Korrektur ${index + 1} av ${lines.length} · Offert ${reference}`);
        py = 96;
      }
      const boxY = py + 4;
      doc.roundedRect(left, boxY, width, 70, 12).strokeColor(LINE).lineWidth(1).stroke();
      doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text("Godkänn korrektur", left + 16, boxY + 12);
      doc.font("Helvetica").fontSize(8.5).fillColor(MUTE).text("Godkänn digitalt via er delade offertlänk, eller signera här och skicka tillbaka.", left + 16, boxY + 26, { width: width - 32 });
      const fields = ["Datum", "Namn", "Signatur"];
      const fw = (width - 32 - 20) / 3;
      fields.forEach((f, i) => {
        const fx = left + 16 + i * (fw + 10);
        doc.moveTo(fx, boxY + 56).lineTo(fx + fw, boxY + 56).strokeColor("#c7c7cc").lineWidth(0.7).stroke();
        doc.font("Helvetica").fontSize(7).fillColor(MUTE).text(f.toUpperCase(), fx, boxY + 59);
      });

      footer("3D-korrekturet visar placering, storlek och metod. Färger på skärm och i tryck kan skilja något, och placering och storlek gäller med ungefär ±5 mm. Ordern blir bindande först när ni godkänt offert och korrektur.");
    });

  doc.end();
  return done;
}
