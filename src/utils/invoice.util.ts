import PDFDocument from "pdfkit";

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  firstName?: string;
  companyName?: string;
  email: string;
  mobileNumber: string;
  donorType: string;
  address: string;
  panOrGstNumber?: string;
  amount: number;
  razorpayPaymentId: string;
}

// Trust's own details — fill these in with the real registered values
// before going live.
const ORG_DETAILS = {
  name: "Nallathangal Water Resources Trust",
  address: "Dharapuram, Tiruppur – Tamil Nadu",
  email: "info@nallathangaltrust.org",
  phone: "+91 98765 43210",
};

// CSR is billed under the company name; Public/Party under the
// donor's first name. Kept as a tiny local helper (rather than
// importing the service) so this util has no dependency on Mongoose.
function resolveBilledName(data: InvoiceData): string {
  return data.donorType === "CSR"
    ? data.companyName || "Valued Partner"
    : data.firstName || "Valued Donor";
}

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
        .text(
          data.donorType === "CSR" ? "CSR Partnership Receipt / Tax Invoice" : "Donation Receipt / Tax Invoice",
          { align: "center" }
        );
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

      // Donor details — label and value both switch for CSR
      doc.font("Helvetica-Bold").text("Billed To:", 50, doc.y);
      doc.moveDown(0.3);
      doc.font("Helvetica").text(resolveBilledName(data));
      doc.text(data.address);
      doc.text(`Mobile: ${data.mobileNumber}`);
      doc.text(`Email: ${data.email}`);
      doc.text(`Donor Type: ${data.donorType}`);
      if (data.panOrGstNumber) {
        doc.text(
          data.donorType === "CSR"
            ? `GSTIN: ${data.panOrGstNumber}`
            : `PAN/GSTIN: ${data.panOrGstNumber}`
        );
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
      doc.text(
        data.donorType === "CSR" ? "CSR Partnership Contribution" : "Voluntary Donation",
        50,
        rowTop,
        { width: 240 }
      );
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
          data.donorType === "CSR"
            ? "Note: This contribution is made under Corporate Social Responsibility (CSR) obligations and may be eligible for CSR reporting under applicable regulations. This receipt confirms the payment received; please retain it for your records."
            : "Note: Donations to registered charitable trusts may be eligible for tax exemption under applicable sections of the Income Tax Act. This receipt confirms the payment received; please retain it for your records.",
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