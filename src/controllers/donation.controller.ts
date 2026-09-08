import type { Request, Response } from "express";
import * as crypto from "crypto";
import { razorpayInstance } from "../config/razorpay.config.js";
import {
  createDonation,
  getAllDonations,
  getDonationById,
  getDonationsByContact,
  attachRazorpayOrder,
  markDonationPaid,
  markDonationFailed,
  getTotalRaisedAmount,
  generateInvoiceNumber,
  attachInvoiceNumber,
  markInvoiceEmailSent,
  getDonorDisplayName,
  deleteDonationById,
} from "../services/donation.service.js";
import {
  findVolunteerByEmailOrMobile,
  createVolunteerFromDonation,
  getVolunteerById,
} from "../services/Volunteer.service.js";
import { generateDonationInvoice } from "../utils/invoice.util.js";
import { sendDonationInvoiceEmail, sendVolunteerWelcomeEmail } from "../utils/send.util.js";
import type { AuthenticatedVolunteerRequest } from "../middleware/volunteerAuth.middleware.js";

const VALID_DONOR_TYPES = ["CSR", "Public", "Party"];

export const createDonationController = async (req: Request, res: Response) => {
  try {
    const {
      firstName,
      companyName,
      email,
      mobileNumber,
      donorType,
      panOrGstNumber,
      address,
      amount,
    } = req.body;

    if (!email || !mobileNumber || !donorType || !address || !amount) {
      return res.status(400).json({
        success: false,
        message: "Email, mobile number, donor type, address and amount are required",
      });
    }

    if (!VALID_DONOR_TYPES.includes(donorType)) {
      return res.status(400).json({
        success: false,
        message: "Donor type must be one of CSR, Public or Party",
      });
    }

    // Name and GST requirement depend on donor type
    if (donorType === "CSR") {
      if (!companyName) {
        return res.status(400).json({
          success: false,
          message: "Company name is required for CSR donations",
        });
      }
      if (!panOrGstNumber) {
        return res.status(400).json({
          success: false,
          message: "GST number is required for CSR donations",
        });
      }
    } else {
      if (!firstName) {
        return res.status(400).json({
          success: false,
          message: "First name is required",
        });
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address" });
    }

    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobileNumber)) {
      return res.status(400).json({ success: false, message: "Please enter a valid 10-digit mobile number" });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: "Please enter a valid donation amount" });
    }

    const donation = await createDonation({
      firstName,
      companyName,
      email,
      mobileNumber,
      donorType,
      panOrGstNumber,
      address,
      amount: numericAmount,
    });

    return res.status(201).json({
      success: true,
      message: "Donation details submitted successfully",
      data: donation,
    });
  } catch (error) {
    console.error("Create donation error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Step 2: create a Razorpay order for an already-saved donation
export const createDonationOrderController = async (req: Request, res: Response) => {
  try {
    const { donationId } = req.body;

    if (!donationId) {
      return res.status(400).json({ success: false, message: "donationId is required" });
    }

    const donation = await getDonationById(donationId);
    if (!donation) {
      return res.status(404).json({ success: false, message: "Donation not found" });
    }

    // Razorpay expects amount in paise — smallest currency unit
    const amountInPaise = Math.round(donation.amount * 100);

    const order = await razorpayInstance.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `donation_${donation._id}`,
      payment_capture: true,
      notes: {
        donationId: String(donation._id),
        donorName: getDonorDisplayName(donation),
        email: donation.email,
      },
    });

    await attachRazorpayOrder(String(donation._id), order.id);

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID, // safe to expose — this is the public key
    });
  } catch (error: any) {
    console.error("Create Razorpay order error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Step 3: verify the payment signature after Razorpay Checkout succeeds
export const verifyDonationPaymentController = async (req: Request, res: Response) => {
  try {
    const {
      donationId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!donationId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing verification fields" });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET as string;

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      await markDonationFailed(donationId);
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    const donation = await markDonationPaid(donationId, razorpay_payment_id);

    if (!donation) {
      return res.status(404).json({ success: false, message: "Donation not found" });
    }

    // Fire the invoice email, but never let an email failure turn a
    // successful, verified payment into an error response to the donor —
    // the payment already succeeded; email delivery is best-effort on top.
    try {
      const invoiceNumber = await generateInvoiceNumber();
      await attachInvoiceNumber(donationId, invoiceNumber);

      const pdfBuffer = await generateDonationInvoice({
        invoiceNumber,
        invoiceDate: new Date(),
        firstName: donation.firstName,
        companyName: donation.companyName,
        email: donation.email,
        mobileNumber: donation.mobileNumber,
        donorType: donation.donorType,
        address: donation.address,
        panOrGstNumber: donation.panOrGstNumber,
        amount: donation.amount,
        razorpayPaymentId: razorpay_payment_id,
      });

      const invoiceMailResult = await sendDonationInvoiceEmail({
        donorEmail: donation.email,
        donorName: getDonorDisplayName(donation),
        invoiceNumber,
        amount: donation.amount,
        pdfBuffer,
      });

      console.log("Donation invoice email sent:", {
        messageId: invoiceMailResult.messageId,
        accepted: invoiceMailResult.accepted,
        rejected: invoiceMailResult.rejected,
      });

      await markInvoiceEmailSent(donationId);
    } catch (emailErr: any) {
      console.error("Invoice email failed (payment still recorded as paid):", emailErr.message);
    }

    // If this donor isn't already a registered volunteer, spin up an
    // account for them from the donation details. Best-effort, same
    // reasoning as the invoice email above — never let this touch the
    // payment response, since the payment already succeeded either way.
    try {
      const existingVolunteer = await findVolunteerByEmailOrMobile(
        donation.email,
        donation.mobileNumber
      );

      console.log(existingVolunteer)

      console.log(donation.email)
      console.log(donation.mobileNumber)

      if (!existingVolunteer) {
        const { volunteer, rawToken } = await createVolunteerFromDonation({
          name: getDonorDisplayName(donation),
          email: donation.email,
          mobile: donation.mobileNumber,

          
        });

        if (!process.env.FRONTEND_URL) {
          console.error("FRONTEND_URL is not set — cannot build volunteer set-password link");
        } else {
          const setPasswordUrl = `${process.env.FRONTEND_URL}/volunteer/set-password?token=${rawToken}`;

          const welcomeMailResult = await sendVolunteerWelcomeEmail({
            volunteerEmail: volunteer.email,
            volunteerName: volunteer.name,
            setPasswordUrl,
          });

          console.log("Volunteer welcome email sent:", {
            messageId: welcomeMailResult.messageId,
            accepted: welcomeMailResult.accepted,
            rejected: welcomeMailResult.rejected,
          });
        }
      } else {
        console.log("Skipped volunteer creation — already a volunteer:", existingVolunteer.email);
        console.log(existingVolunteer)
      }
    } catch (volunteerErr: any) {
      console.error("Auto volunteer creation failed (donation still recorded as paid):", volunteerErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified and donation marked as paid",
      data: donation,
    });
  } catch (error: any) {
    console.error("Verify donation payment error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllDonationsController = async (req: Request, res: Response) => {
  try {
    const donations = await getAllDonations();
    return res.status(200).json({ success: true, data: donations });
  } catch (error) {
    console.error("Get donations error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const getDonationByIdController = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const donation = await getDonationById(id);
    if (!donation) {
      return res.status(404).json({ success: false, message: "Donation not found" });
    }
    return res.status(200).json({ success: true, data: donation });
  } catch (error) {
    console.error("Get donation error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Powers the volunteer-facing "My Donations" page — returns only the
// donations belonging to the currently authenticated volunteer, matched
// by their own email/mobile (same pairing the donation flow itself uses
// via findVolunteerByEmailOrMobile). Volunteer-gated rather than
// admin-gated, since this is a volunteer viewing their own history, not
// an admin viewing everyone's.
export const getMyDonationsController = async (
  req: AuthenticatedVolunteerRequest,
  res: Response
) => {
  try {
    const volunteer = await getVolunteerById(req.volunteerId as string);
    if (!volunteer) {
      return res.status(404).json({ success: false, message: "Volunteer not found" });
    }

    const donations = await getDonationsByContact(volunteer.email, volunteer.mobile);
    return res.status(200).json({ success: true, data: donations });
  } catch (error) {
    console.error("Get my donations error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Powers the FundraisingSection progress card — total ₹ raised (only
// donations that actually completed payment) plus a donor count.
export const getTotalRaisedController = async (req: Request, res: Response) => {
  try {
    const { totalAmount, donorCount } = await getTotalRaisedAmount();

    return res.status(200).json({
      success: true,
      data: {
        totalAmount, // in rupees
        donorCount,
      },
    });
  } catch (error) {
    console.error("Get total raised error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Regenerates and streams the donation invoice as a downloadable PDF.
export const getDonationInvoiceController = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const donation = await getDonationById(id);

    if (!donation) {
      return res.status(404).json({ success: false, message: "Donation not found" });
    }

    if (!donation.invoiceNumber) {
      return res.status(400).json({
        success: false,
        message: "Invoice not yet generated for this donation",
      });
    }

    const pdfBuffer = await generateDonationInvoice({
      invoiceNumber: donation.invoiceNumber,
      invoiceDate: donation.updatedAt,
      firstName: donation.firstName,
      companyName: donation.companyName,
      email: donation.email,
      mobileNumber: donation.mobileNumber,
      donorType: donation.donorType,
      address: donation.address,
      panOrGstNumber: donation.panOrGstNumber,
      amount: donation.amount,
      razorpayPaymentId: donation.razorpayPaymentId ?? "",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Donation-Receipt-${donation.invoiceNumber}.pdf"`
    );
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Generate donation invoice error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Admin-only: permanently deletes a donation record from the table.
export const deleteDonationController = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const donation = await deleteDonationById(id);

    if (!donation) {
      return res.status(404).json({ success: false, message: "Donation not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Donation deleted successfully",
    });
  } catch (error) {
    console.error("Delete donation error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};