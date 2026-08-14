import PDFDocument from "pdfkit";

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  firstName: string;
  email: string;
  mobileNumber: string;
  donorType: string;
  address: string;
  panOrGstNumber?: string;
  amount: number;
  razorpayPaymentId: string;
}

// Trust's own details — fill these in with the real registered values
// before going live. GSTIN is required on every line if the trust is
// GST-registered; if it is not registered, remove the GSTIN line/field
// entirely rather than leaving it blank, since a blank GSTIN field on an
// invoice can be read as non-compliant rather than "not applicable".
const ORG_DETAILS = {
  name: "Nallathangal Water Resources Trust",
  address: "Dharapuram, Tiruppur – Tamil Nadu",
  gstin: "PLACEHOLDER_GSTIN", // TODO: replace with real GSTIN
  pan: "PLACEHOLDER_PAN", // TODO: replace with real PAN
  email: "info@nallathangaltrust.org",
  phone: "+91 98765 43210",
};

// Builds the invoice PDF in memory and resolves with a Buffer — no temp
// files written to disk, so it can go straight into a mail attachment.
export function generateDonationInvoice(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc
        .fontSize(18)
        .font("Helvetica-Bold")
        .text(ORG_DETAILS.name, { align: "center" });
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(ORG_DETAILS.address, { align: "center" });
      doc.text(
        `GSTIN: ${ORG_DETAILS.gstin}  |  PAN: ${ORG_DETAILS.pan}`,
        { align: "center" }
      );
      doc.text(
        `${ORG_DETAILS.email}  |  ${ORG_DETAILS.phone}`,
        { align: "center" }
      );

      doc.moveDown(1);
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#0b3d2e")
        .stroke();
      doc.moveDown(1);

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Donation Receipt / Tax Invoice", { align: "center" });
      doc.moveDown(1.5);

      // Invoice meta
      const metaTop = doc.y;
      doc.fontSize(10).font("Helvetica-Bold").text("Invoice No:", 50, metaTop);
      doc.font("Helvetica").text(data.invoiceNumber, 150, metaTop);

      doc.font("Helvetica-Bold").text("Invoice Date:", 320, metaTop);
      doc
        .font("Helvetica")
        .text(data.invoiceDate.toLocaleDateString("en-IN"), 420, metaTop);

      doc.moveDown(1.5);

      // Donor details
      doc.font("Helvetica-Bold").text("Billed To:", 50, doc.y);
      doc.moveDown(0.3);
      doc.font("Helvetica").text(data.firstName);
      doc.text(data.address);
      doc.text(`Mobile: ${data.mobileNumber}`);
      doc.text(`Email: ${data.email}`);
      doc.text(`Donor Type: ${data.donorType}`);
      if (data.panOrGstNumber) {
        doc.text(`PAN/GSTIN: ${data.panOrGstNumber}`);
      }

      doc.moveDown(1.5);

      // Table header
      const tableTop = doc.y;
      doc.font("Helvetica-Bold");
      doc.text("Description", 50, tableTop);
      doc.text("Payment Ref", 300, tableTop);
      doc.text("Amount (INR)", 450, tableTop, { width: 95, align: "right" });

      doc
        .moveTo(50, tableTop + 15)
        .lineTo(545, tableTop + 15)
        .stroke();

      const rowTop = tableTop + 25;
      doc.font("Helvetica");
      doc.text("Voluntary Donation", 50, rowTop, { width: 240 });
      doc.text(data.razorpayPaymentId, 300, rowTop, { width: 140 });
      doc.text(data.amount.toLocaleString("en-IN"), 450, rowTop, {
        width: 95,
        align: "right",
      });

      doc
        .moveTo(50, rowTop + 25)
        .lineTo(545, rowTop + 25)
        .stroke();

      doc
        .font("Helvetica-Bold")
        .text("Total Paid:", 300, rowTop + 35);
      doc.text(`INR ${data.amount.toLocaleString("en-IN")}`, 450, rowTop + 35, {
        width: 95,
        align: "right",
      });

      doc.moveDown(4);
      doc
        .fontSize(9)
        .font("Helvetica-Oblique")
        .fillColor("#555555")
        .text(
          "Note: Donations to registered charitable trusts may be eligible for tax exemption under applicable sections of the Income Tax Act. This receipt confirms the payment received; please retain it for your records.",
          50,
          doc.y,
          { width: 495 }
        );

      doc.moveDown(2);
      doc
        .fontSize(9)
        .fillColor("#888888")
        .text(
          "This is a system-generated receipt and does not require a physical signature.",
          50,
          doc.y,
          { width: 495, align: "center" }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}