import type { Request, Response } from "express";
import * as crypto from "crypto";
import { razorpayInstance } from "../config/razorpay.config.js";
import {
  createDonation,
  getAllDonations,
  getDonationById,
  attachRazorpayOrder,
  markDonationPaid,
  markDonationFailed,
  getTotalRaisedAmount,
  generateInvoiceNumber,
  attachInvoiceNumber,
  markInvoiceEmailSent,
} from "../services/donation.service.js";
import { generateDonationInvoice } from "../utils/invoice.util.js";
import { sendDonationInvoiceEmail } from "../utils/send.util.js";

const VALID_DONOR_TYPES = ["CSR", "Public", "Party"];

export const createDonationController = async (req: Request, res: Response) => {
  try {
    const { firstName, email, mobileNumber, donorType, panOrGstNumber, address, amount } = req.body;

    if (!firstName || !email || !mobileNumber || !donorType || !address || !amount) {
      return res.status(400).json({
        success: false,
        message: "First name, email, mobile number, donor type, address and amount are required",
      });
    }

    if (!VALID_DONOR_TYPES.includes(donorType)) {
      return res.status(400).json({
        success: false,
        message: "Donor type must be one of CSR, Public or Party",
      });
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
        firstName: donation.firstName,
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
        email: donation.email,
        mobileNumber: donation.mobileNumber,
        donorType: donation.donorType,
        address: donation.address,
        panOrGstNumber: donation.panOrGstNumber,
        amount: donation.amount,
        razorpayPaymentId: razorpay_payment_id,
      });

      await sendDonationInvoiceEmail({
        donorEmail: donation.email,
        donorName: donation.firstName,
        invoiceNumber,
        amount: donation.amount,
        pdfBuffer,
      });

      await markInvoiceEmailSent(donationId);
    } catch (emailErr: any) {
      console.error("Invoice email failed (payment still recorded as paid):", emailErr.message);
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
// Used for the auto-download right after payment verification on the
// frontend, and can also be reused later for a "resend/redownload my
// receipt" feature if needed — same pdfkit-in-memory pattern as the
// volunteer ID card.
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