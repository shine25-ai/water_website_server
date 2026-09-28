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

// Names come from user input (donation form), so escape them before
// dropping into HTML to avoid broken markup / injection in the email.
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export async function sendDonationInvoiceEmail({
  donorEmail,
  donorName,
  invoiceNumber,
  amount,
  pdfBuffer,
}: SendInvoiceEmailParams) {
  const subject = `Donation Receipt – ${invoiceNumber} | Nallathangal Water Resources Trust`;
  const safeName = escapeHtml(donorName);

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0b3d2e; line-height: 1.5;">
      <h2 style="color: #0b3d2e;">Thank you for your donation, ${safeName}!</h2>
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

  // Donor is the sole recipient — no BCC to a company mailbox.
  // Returns the send result so callers can log messageId/accepted/rejected.
  return await mailTransporter.sendMail({
    from: `"Nallathangal Water Resources Trust" <${process.env.SMTP_USER}>`,
    to: donorEmail,
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
  const safeName = escapeHtml(volunteerName);

  // FIX: the original was missing the opening "<a" — the attributes
  // (href/style) and closing "</a>" were there, so the mail rendered the
  // raw text `href="..."` instead of a button.
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0b3d2e; line-height: 1.5;">
      <h2 style="color: #0b3d2e;">Welcome aboard, ${safeName}!</h2>
      <p>
        Thank you for your donation. Alongside your receipt, we've set up a
        volunteer account for you so you can track your contributions and get
        involved further with the Nallathangal Water Resources Trust.
      </p>
      <p style="margin: 24px 0;">
        <a
          href="${setPasswordUrl}"
          style="
            display: inline-block;
            background: #0b3d2e;
            color: #ffffff;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
          "
        >
          Set your password
        </a>
      </p>
      <p style="font-size: 13px; color: #555;">
        Button not working? Copy and paste this link into your browser:<br />
        <span style="word-break: break-all;">${setPasswordUrl}</span>
      </p>
      <p style="font-size: 13px; color: #555;">
        This link expires in 24 hours. Once you're in, you can finish the rest
        of your volunteer profile (village, district, and more) any time.
      </p>
      <br />
      <p style="font-size: 13px; color: #555;">
        Nallathangal Water Resources Trust<br />
        Dharapuram, Tiruppur – Tamil Nadu<br />
        info@nallathangaltrust.org
      </p>
    </div>
  `;

  // Plain-text alternative: improves deliverability (spam filters like a
  // text part) and works in clients that block HTML.
  const text =
    `Welcome aboard, ${volunteerName}!\n\n` +
    `Thank you for your donation. We've set up a volunteer account for you.\n` +
    `Set your password here (expires in 24 hours):\n${setPasswordUrl}\n\n` +
    `Nallathangal Water Resources Trust\nDharapuram, Tiruppur – Tamil Nadu\ninfo@nallathangaltrust.org`;

  return await mailTransporter.sendMail({
    from: `"Nallathangal Water Resources Trust" <${process.env.SMTP_USER}>`,
    to: volunteerEmail,
    subject,
    html,
    text,
  });
}