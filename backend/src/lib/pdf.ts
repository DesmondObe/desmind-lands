import { readFileSync } from "node:fs";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import { formatKobo, formatMoment } from "./format.ts";

// Noto Sans (SIL Open Font License, assets/fonts/OFL.txt): it has the naira sign and the
// letters of Yoruba, Igbo and Hausa names, which the PDF standard fonts do not.
const FONTS = new URL("../../assets/fonts/", import.meta.url);
let fontBytes: { regular: Buffer; bold: Buffer } | undefined;
const loadFonts = () =>
  (fontBytes ??= {
    regular: readFileSync(new URL("NotoSans-Regular.ttf", FONTS)),
    bold: readFileSync(new URL("NotoSans-Bold.ttf", FONTS)),
  });

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 56;
const INK = rgb(0.11, 0.1, 0.09);
const SOFT = rgb(0.42, 0.4, 0.37);
const LINE = rgb(0.85, 0.83, 0.8);
const BRAND = rgb(0.09, 0.25, 0.2);
const LATERITE = rgb(0.66, 0.33, 0.2);

/** A top-to-bottom writer over A4 pages: text wraps to the margins, pages break as they fill. */
class Writer {
  readonly doc: PDFDocument;
  private page!: PDFPage;
  private y = 0;
  private pages = 0;
  readonly regular: PDFFont;
  readonly bold: PDFFont;
  private readonly footer: string;

  private constructor(doc: PDFDocument, regular: PDFFont, bold: PDFFont, footer: string) {
    this.doc = doc;
    this.regular = regular;
    this.bold = bold;
    this.footer = footer;
    this.newPage();
  }

  static async create(title: string, footer: string) {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const { regular, bold } = loadFonts();
    const w = new Writer(
      doc,
      await doc.embedFont(regular, { subset: false }),
      await doc.embedFont(bold, { subset: false }),
      footer,
    );
    doc.setTitle(title);
    doc.setProducer("DesMind Lands");
    doc.setCreator("DesMind Lands");
    return w;
  }

  private newPage() {
    this.page = this.doc.addPage([A4.width, A4.height]);
    this.pages += 1;
    this.y = A4.height - MARGIN;
    // A thin band of the brand across the top of every page.
    this.page.drawRectangle({ x: 0, y: A4.height - 6, width: A4.width, height: 6, color: BRAND });
    this.page.drawRectangle({ x: 0, y: A4.height - 8, width: A4.width, height: 2, color: LATERITE });
    this.page.drawText(`${this.footer} · page ${this.pages}`, {
      x: MARGIN,
      y: 30,
      size: 8,
      font: this.regular,
      color: SOFT,
    });
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN + 24) this.newPage();
  }

  get width() {
    return A4.width - 2 * MARGIN;
  }

  wrap(text: string, font: PDFFont, size: number, width = this.width): string[] {
    const out: string[] = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (const word of paragraph.split(/(\s+)/)) {
        const candidate = line + word;
        if (font.widthOfTextAtSize(candidate, size) <= width || !line.trim()) {
          line = candidate;
          continue;
        }
        out.push(line.trimEnd());
        line = word.trimStart();
      }
      while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > width) cut--;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
      out.push(line.trimEnd());
    }
    return out;
  }

  text(text: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.regular;
    const leading = size * 1.5;
    for (const line of this.wrap(text, font, size)) {
      this.ensure(leading);
      this.y -= leading;
      this.page.drawText(line, { x: MARGIN, y: this.y + size * 0.3, size, font, color: opts.color ?? INK });
    }
    this.y -= opts.gap ?? 0;
  }

  keep(height: number) {
    this.ensure(height);
  }

  space(h: number) {
    this.y -= h;
  }

  rule() {
    this.ensure(12);
    this.y -= 6;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: A4.width - MARGIN, y: this.y },
      thickness: 0.75,
      color: LINE,
    });
    this.y -= 8;
  }

  row(label: string, value: string) {
    const size = 9.5;
    const labelWidth = 120;
    const lines = this.wrap(value, this.regular, size, this.width - labelWidth);
    const leading = size * 1.5;
    this.ensure(leading * lines.length);
    this.page.drawText(label, { x: MARGIN, y: this.y - leading + size * 0.3, size, font: this.regular, color: SOFT });
    for (const line of lines) {
      this.y -= leading;
      this.page.drawText(line, {
        x: MARGIN + labelWidth,
        y: this.y + size * 0.3,
        size,
        font: this.regular,
        color: INK,
      });
    }
  }

  async save() {
    return Buffer.from(await this.doc.save());
  }
}

export type Signer = {
  role: string;
  name: string;
  signedName: string | null;
  signedAt: string | null;
  ip?: string;
  extra?: string;
};

export type Settlement = { amountKobo: number; paidOn: string; method: string; reference: string; status: string };

/**
 * The agreement as signed: the full text, then each signature with its witness, then the
 * certificate of who signed, when, from where, and over which text (its SHA-256).
 */
export async function agreementPdf(opts: {
  dealId: string;
  text: string;
  hash: string;
  signers: Signer[];
  payments: Settlement[];
  completedAt: string | null;
}) {
  const w = await Writer.create("Contract of Sale of Land", `DesMind Lands · deal ${opts.dealId.slice(0, 8)}`);
  const [heading, ...rest] = opts.text.split("\n\n");
  w.space(10);
  w.text("DESMIND LANDS", { size: 8, bold: true, color: LATERITE, gap: 4 });
  w.text(heading ?? "CONTRACT OF SALE OF LAND", { size: 20, bold: true, color: BRAND, gap: 10 });
  for (const block of rest) {
    const [first, ...body] = block.split("\n");
    const isClause = /^\d+\.\s+[A-Z' ]+$/.test(first ?? "");
    if (isClause) {
      w.keep(48);
      w.text(first!, { size: 10.5, bold: true, color: BRAND, gap: 2 });
      w.text(body.join("\n"), { gap: 10 });
    } else {
      w.text(block, { gap: 10 });
    }
  }

  w.keep(120);
  w.space(6);
  w.text("SIGNED, AND WITNESSED, ELECTRONICALLY", { size: 10.5, bold: true, color: BRAND, gap: 6 });
  for (const s of opts.signers) {
    w.keep(70);
    w.rule();
    w.text(s.role.toUpperCase(), { size: 8, bold: true, color: SOFT });
    w.text(s.signedName ? `/s/ ${s.signedName}` : "Not signed", {
      size: 15,
      bold: !!s.signedName,
      color: s.signedName ? BRAND : SOFT,
    });
    w.row("Name", s.name);
    if (s.extra) w.row("Details", s.extra);
    w.row("Signed", s.signedAt ? formatMoment(s.signedAt) : "—");
    if (s.ip) w.row("From address", s.ip);
  }

  if (opts.payments.length) {
    w.keep(80);
    w.space(10);
    w.text("PAYMENTS RECORDED", { size: 10.5, bold: true, color: BRAND, gap: 4 });
    for (const p of opts.payments) {
      w.row(
        formatKobo(p.amountKobo),
        `${p.method} on ${p.paidOn}${p.reference ? `, reference ${p.reference}` : ""}: ${p.status}`,
      );
    }
  }

  w.keep(90);
  w.space(10);
  w.rule();
  w.text("CERTIFICATE OF RECORD", { size: 10.5, bold: true, color: BRAND, gap: 4 });
  w.text(
    `Every signature above was made over the same text of this agreement, whose SHA-256 fingerprint is:\n${opts.hash}\nAny change to a single character of the text gives a different fingerprint. The full record of the deal (offers, messages, checks, payments and their receipts) is kept on DesMind Lands.${
      opts.completedAt ? `\nThe Parties confirmed completion and handover on ${formatMoment(opts.completedAt)}.` : ""
    }`,
    { size: 9, color: SOFT },
  );
  return w.save();
}
