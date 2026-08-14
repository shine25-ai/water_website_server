import PDFDocument from "pdfkit";

interface IdCardData {
  volunteerId: string;
  name: string;
  email: string;
  mobile: string;
  village: string;
  district: string;
  profession?: string;
  age: number;
  interestArea?: string;
  contributions: string[];
  // Raw image bytes, fetched from S3 by the caller — pdfkit accepts a
  // Buffer directly, so there's no need to touch the filesystem.
  photoBuffer?: Buffer;
  issueDate: Date;
}

const ORG_NAME = "Nallathangal Water Resources Trust";
const ORG_TAGLINE = "Water Secures Life";
const BRAND_GREEN = "#0b3d2e";
const BRAND_GREEN_DARK = "#062219";
const BRAND_GOLD = "#f5b400";
const INK = "#12333C";
const MUTED = "#8a8a8a";
const CARD_BG = "#fdfbf5";
const HAIRLINE = "#e3ddc9";

// Card geometry — sized generously (taller than a literal wallet card) so
// every section — header, photo, name/ID, and every detail row — has a
// fixed, pre-budgeted amount of space. Nothing here relies on pdfkit's
// automatic text flow, so nothing can silently overflow onto a second
// page: every text() call gets an explicit box with `ellipsis: true`,
// which truncates instead of wrapping past its row.
const PAGE_W = 324;
const PAGE_H = 620;

const HEADER_H = 100;
const PHOTO_R = 46;
const PHOTO_AREA_H = PHOTO_R * 2 + 30;
const NAME_H = 24;
const ID_BADGE_H = 34;
const DIVIDER_H = 26;
const ROW_H = 44; // uniform row height: label + value + gap, per detail row
const FOOTER_H = 54;

// Draws the trust's leaf/droplet mark (same silhouette used in the site
// navbar) at an arbitrary position/scale, so the card carries the same
// brand identity as the website instead of a generic circle.
function drawLogoMark(doc: PDFKit.PDFDocument, cx: number, cy: number, scale: number, color: string) {
  doc.save();
  doc.translate(cx, cy).scale(scale);
  doc
    .path("M0 -16C6 -8 11 -3 11 3A11 11 0 1 1 -11 3C-11 -3 -6 -8 0 -16Z")
    .fill(color);
  doc.restore();
}

// Builds the volunteer ID card as a single-page PDF, in memory, and
// resolves with a Buffer — same pattern as the donation invoice, so it
// can be streamed straight into an HTTP response with no temp files.
export function generateVolunteerIdCard(data: IdCardData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // ---- Card background + outer frame -------------------------------
      doc.rect(0, 0, PAGE_W, PAGE_H).fill(CARD_BG);
      doc
        .roundedRect(4, 4, PAGE_W - 8, PAGE_H - 8, 10)
        .lineWidth(1.25)
        .strokeColor(BRAND_GOLD)
        .stroke();

      // ---- Header --------------------------------------------------------
      doc.save();
      doc.roundedRect(4, 4, PAGE_W - 8, HEADER_H, 10).clip();
      doc.rect(0, 0, PAGE_W, HEADER_H + 12).fill(BRAND_GREEN);
      // subtle darker band along the very top for depth
      doc.rect(0, 0, PAGE_W, 6).fill(BRAND_GREEN_DARK);
      doc.restore();

      drawLogoMark(doc, 30, 30, 1.05, BRAND_GOLD);

      doc
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(11.5)
        .text(ORG_NAME, 48, 17, { width: PAGE_W - 64, height: 28, ellipsis: true });
      doc
        .font("Helvetica-Oblique")
        .fontSize(8)
        .fillColor(BRAND_GOLD)
        .text(ORG_TAGLINE, 48, 38, { width: PAGE_W - 64, height: 12, ellipsis: true });

      // "VOLUNTEER ID CARD" pill, centered, sitting on the header's lower edge
      const pillText = "VOLUNTEER ID CARD";
      doc.font("Helvetica-Bold").fontSize(9);
      const pillWidth = doc.widthOfString(pillText) + 28;
      const pillY = HEADER_H - 14;
      doc
        .roundedRect(PAGE_W / 2 - pillWidth / 2, pillY, pillWidth, 22, 11)
        .fill(BRAND_GOLD);
      doc
        .fillColor(BRAND_GREEN_DARK)
        .text(pillText, PAGE_W / 2 - pillWidth / 2, pillY + 6, { width: pillWidth, align: "center" });

      // ---- Photo -----------------------------------------------------
      const photoCenterX = PAGE_W / 2;
      const photoCenterY = HEADER_H + 18 + PHOTO_R;

      // soft shadow disc behind the photo
      doc.save();
      doc.fillColor("#000000").opacity(0.08);
      doc.circle(photoCenterX + 2, photoCenterY + 3, PHOTO_R + 3).fill();
      doc.opacity(1);
      doc.restore();

      doc
        .circle(photoCenterX, photoCenterY, PHOTO_R + 3)
        .lineWidth(1)
        .strokeColor(BRAND_GOLD)
        .stroke();
      doc
        .circle(photoCenterX, photoCenterY, PHOTO_R)
        .lineWidth(2.5)
        .strokeColor(BRAND_GREEN)
        .stroke();

      if (data.photoBuffer) {
        doc.save();
        doc.circle(photoCenterX, photoCenterY, PHOTO_R - 2).clip();
        doc.image(
          data.photoBuffer,
          photoCenterX - PHOTO_R,
          photoCenterY - PHOTO_R,
          { width: PHOTO_R * 2, height: PHOTO_R * 2, cover: [PHOTO_R * 2, PHOTO_R * 2] }
        );
        doc.restore();
      } else {
        doc.fillColor("#eaf6ee").circle(photoCenterX, photoCenterY, PHOTO_R - 2).fill();
        doc
          .fillColor(BRAND_GREEN)
          .font("Helvetica-Bold")
          .fontSize(30)
          .text(data.name.charAt(0).toUpperCase(), photoCenterX - PHOTO_R, photoCenterY - 15, {
            width: PHOTO_R * 2,
            align: "center",
          });
      }

      // ---- Name + Volunteer ID badge --------------------------------
      let y = HEADER_H + PHOTO_AREA_H + 4;

      doc
        .fillColor(INK)
        .font("Helvetica-Bold")
        .fontSize(15)
        .text(data.name, 16, y, { width: PAGE_W - 32, height: NAME_H, align: "center", ellipsis: true });
      y += NAME_H + 6;

      const idText = data.volunteerId;
      doc.font("Courier-Bold").fontSize(10.5);
      const idWidth = doc.widthOfString(idText) + 24;
      doc
        .roundedRect(PAGE_W / 2 - idWidth / 2, y, idWidth, 22, 11)
        .fillAndStroke(BRAND_GOLD, BRAND_GREEN_DARK);
      doc
        .fillColor(BRAND_GREEN_DARK)
        .text(idText, PAGE_W / 2 - idWidth / 2, y + 6, { width: idWidth, align: "center" });
      y += ID_BADGE_H;

      // ---- Section divider ---------------------------------------------
      const sectionLabel = "VOLUNTEER DETAILS";
      doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED);
      const sectionLabelWidth = doc.widthOfString(sectionLabel);
      const lineY = y + 9;
      const gap = 8;
      const sideLineWidth = (PAGE_W - 32 - sectionLabelWidth - gap * 2) / 2;
      doc.strokeColor(HAIRLINE).lineWidth(1);
      doc.moveTo(16, lineY).lineTo(16 + sideLineWidth, lineY).stroke();
      doc
        .moveTo(PAGE_W - 16 - sideLineWidth, lineY)
        .lineTo(PAGE_W - 16, lineY)
        .stroke();
      doc.text(sectionLabel, 16 + sideLineWidth + gap, y, {
        width: sectionLabelWidth + 4,
        align: "center",
      });
      y += DIVIDER_H;

      // ---- Detail rows ----------------------------------------------
      // Every value is drawn in a fixed-height, ellipsis-truncated box,
      // so no field — however long — can ever push content past its
      // allotted row and trigger pdfkit's automatic page break.
      const colGutter = 12;
      const colWidth = (PAGE_W - 32 - colGutter) / 2;
      const leftX = 16;
      const rightX = 16 + colWidth + colGutter;

      const writeField = (
        label: string,
        value: string,
        x: number,
        rowY: number,
        width: number,
        maxLines = 1
      ) => {
        doc
          .font("Helvetica-Bold")
          .fontSize(7.5)
          .fillColor(MUTED)
          .text(label.toUpperCase(), x, rowY, { width, height: 10 });
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor(INK)
          .text(value || "-", x, rowY + 12, {
            width,
            height: maxLines * 13,
            ellipsis: true,
          });
      };

      // Row 1 — Mobile | Age
      writeField("Mobile", data.mobile, leftX, y, colWidth);
      writeField("Age", String(data.age), rightX, y, colWidth);
      y += ROW_H;

      // Row 2 — Village | District
      writeField("Village", data.village, leftX, y, colWidth);
      writeField("District", data.district, rightX, y, colWidth);
      y += ROW_H;

      // Row 3 — Profession (optional, full width)
      if (data.profession) {
        writeField("Profession", data.profession, leftX, y, PAGE_W - 32);
        y += ROW_H;
      }

      // Row 4 — Email (full width, may be long)
      writeField("Email", data.email, leftX, y, PAGE_W - 32);
      y += ROW_H;

      // Row 5 — Interest (optional, full width)
      if (data.interestArea) {
        writeField("Interest", data.interestArea, leftX, y, PAGE_W - 32);
        y += ROW_H;
      }

      // Row 6 — Contributions (optional, full width, up to 2 lines)
      if (data.contributions.length > 0) {
        writeField("Contributes To", data.contributions.join(", "), leftX, y, PAGE_W - 32, 2);
        y += ROW_H + 10;
      }

      // ---- Footer --------------------------------------------------------
      const footerY = PAGE_H - FOOTER_H - 4;
      doc.save();
      doc.roundedRect(4, footerY, PAGE_W - 8, FOOTER_H, 10).clip();
      doc.rect(0, footerY - 8, PAGE_W, FOOTER_H + 12).fill(BRAND_GREEN);
      doc.restore();

      doc
        .fillColor("#ffffff")
        .font("Helvetica")
        .fontSize(7)
        .text(
          `Issued ${data.issueDate.toLocaleDateString("en-IN")} — valid while volunteer registration is active.`,
          14,
          footerY + 10,
          { width: PAGE_W - 28, align: "center" }
        );
      doc
        .fillColor(BRAND_GOLD)
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .text("Dharapuram, Tiruppur – Tamil Nadu", 14, footerY + 24, {
          width: PAGE_W - 28,
          align: "center",
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}