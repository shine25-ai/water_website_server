import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  throw new Error("SMTP_USER / SMTP_PASS are missing in environment variables");
}

// Gmail SMTP requires an App Password (not your normal Gmail password) —
// generate one at https://myaccount.google.com/apppasswords (needs 2FA on).
// For production sending volumes, swap this for a transactional email
// provider (SES, SendGrid, Postmark) instead of Gmail SMTP.
//
// `service: "gmail"` is nodemailer's built-in preset — it knows the
// correct host/port/TLS combination for Gmail internally, which avoids
// "wrong version number" TLS handshake errors from a mismatched
// host/port/secure combination.
//
// `family: 4` forces IPv4-only DNS resolution — some Windows machines +
// ISPs/VPNs advertise a broken IPv6 route to Gmail, causing ENETUNREACH
// on the IPv6 address before IPv4 is ever tried.
//
// Both `service` and `family` are real, documented nodemailer/
// smtp-connection options, but @types/nodemailer's bundled type
// definitions are incomplete and don't recognize them on the same
// overload — so this file intentionally skips strict typing on the
// transport config object rather than fighting the types package.
const transportOptions: Record<string, unknown> = {
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  family: 4,
};

export const mailTransporter = nodemailer.createTransport(transportOptions as never);