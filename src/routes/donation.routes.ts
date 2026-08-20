import { Router } from "express";
import {
  createDonationController,
  createDonationOrderController,
  verifyDonationPaymentController,
  getAllDonationsController,
  getDonationByIdController,
  getTotalRaisedController,
  getDonationInvoiceController,
} from "../controllers/donation.controller.js";
import { requireAdminAuth } from "../middleware/Adminauth.middleware.js";

const router = Router();

// IMPORTANT: static routes like /total-raised, /create-order, and
// /:id/invoice must be declared before the dynamic "/:id" route below,
// otherwise Express will treat "total-raised" (etc.) as an :id value and
// hit getDonationByIdController instead.

// Public — donor-facing payment flow, no admin session involved.
router.post("/", createDonationController);
router.post("/create-order", createDonationOrderController);
router.post("/verify-payment", verifyDonationPaymentController);

// Public — only an aggregate total + count, no personal donor data.
router.get("/total-raised", getTotalRaisedController);

// Admin-gated from here down — these expose donor email, mobile,
// address, and PAN/GST, so they're not for public consumption.
router.get("/:id/invoice", requireAdminAuth, getDonationInvoiceController);
router.get("/", requireAdminAuth, getAllDonationsController);
router.get("/:id", requireAdminAuth, getDonationByIdController);

export default router;