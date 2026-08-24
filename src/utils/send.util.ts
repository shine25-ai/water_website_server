import { mailTransporter } from "../config/Mailer.config.js";

interface SendInvoiceEmailParams {
  donorEmail: string;
  donorName: string;
  invoiceNumber: string;
  amount: number;
  pdfBuffer: Buffer;
}

interface SendVolunteerWelcomeEmailParams {
  volunteerEmail: string;
  volunteerName: string;
  setPasswordUrl: string;
}

const COMPANY_EMAIL = process.env.COMPANY_NOTIFY_EMAIL || "akkrish157@gmail.com";

export async function sendDonationInvoiceEmail({
  donorEmail,
  donorName,
  invoiceNumber,
  amount,
  pdfBuffer,
}: SendInvoiceEmailParams) {
  const subject = `Donation Receipt – ${invoiceNumber} | Nallathangal Water Resources Trust`;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0b3d2e; line-height: 1.5;">
      <h2 style="color: #0b3d2e;">Thank you for your donation, ${donorName}!</h2>
      <p>We've received your donation of <strong>₹${amount.toLocaleString(
        "en-IN"
      )}</strong> in support of the Nallathangal Water Resources Trust.</p>
      <p>Your receipt (Invoice No: <strong>${invoiceNumber}</strong>) is attached to this email as a PDF.</p>
      <p>This contribution helps us continue our water conservation work. We're grateful for your support.</p>
      <br />
      <p style="font-size: 13px; color: #555;">
        Nallathangal Water Resources Trust<br />
        Dharapuram, Tiruppur – Tamil Nadu<br />
        info@nallathangaltrust.org
      </p>
    </div>
  `;

  // Donor gets the email as the primary recipient; the company mailbox is
  // BCC'd so it gets a copy for records without the donor seeing that address.
  // Returns the send result so callers can log messageId/accepted/rejected.
  return await mailTransporter.sendMail({
    from: `"Nallathangal Water Resources Trust" <${process.env.SMTP_USER}>`,
    to: donorEmail,
    bcc: COMPANY_EMAIL,
    subject,
    html,
    attachments: [
      {
        filename: `${invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}

// Sent to the donor's own email (volunteerEmail is always donation.email —
// see verifyDonationPaymentController) right after the receipt email, to
// welcome them as a newly auto-enrolled volunteer.
export async function sendVolunteerWelcomeEmail({
  volunteerEmail,
  volunteerName,
  setPasswordUrl,
}: SendVolunteerWelcomeEmailParams) {
  const subject = `You're now a registered volunteer | Nallathangal Water Resources Trust`;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0b3d2e; line-height: 1.5;">
      <h2 style="color: #0b3d2e;">Welcome aboard, ${volunteerName}!</h2>
      <p>Thank you for your donation. Alongside your receipt, we've set up a volunteer account for you so you can track your contributions and get involved further with the Nallathangal Water Resources Trust.</p>
      <p>
        
          href="${setPasswordUrl}"
          
        >
          Set your password
        </a>
      </p>
      <p style="font-size: 13px; color: #555;">This link expires in 24 hours. Once you're in, you can finish the rest of your volunteer profile (village, district, and more) any time.</p>
      <br />
      <p style="font-size: 13px; color: #555;">
        Nallathangal Water Resources Trust<br />
        Dharapuram, Tiruppur – Tamil Nadu<br />
        info@nallathangaltrust.org
      </p>
    </div>
  `;

  // Returns the send result so the caller can log messageId/accepted/
  // rejected — sendMail can resolve without throwing even if the
  // receiving server soft-rejects the message, and without this there's
  // no visibility into that.
  return await mailTransporter.sendMail({
    from: `"Nallathangal Water Resources Trust" <${process.env.SMTP_USER}>`,
    to: volunteerEmail,
    subject,
    html,
  });
}