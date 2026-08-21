import { Router } from "express";
import {
  createDonationController,
  createDonationOrderController,
  verifyDonationPaymentController,
  getAllDonationsController,
  getDonationByIdController,
  getMyDonationsController,
  getTotalRaisedController,
  getDonationInvoiceController,
} from "../controllers/donation.controller.js";
import { requireAdminAuth } from "../middleware/Adminauth.middleware.js";
import { requireVolunteerAuth } from "../middleware/volunteerAuth.middleware.js";

const router = Router();

// IMPORTANT: static routes like /total-raised, /create-order, /mine, and
// /:id/invoice must be declared before the dynamic "/:id" route below,
// otherwise Express will treat "total-raised" (etc.) as an :id value and
// hit getDonationByIdController instead.

// Public — donor-facing payment flow, no admin session involved.
router.post("/", createDonationController);
router.post("/create-order", createDonationOrderController);
router.post("/verify-payment", verifyDonationPaymentController);

// Public — only an aggregate total + count, no personal donor data.
router.get("/total-raised", getTotalRaisedController);

// Volunteer-gated — a volunteer viewing their own donation history
// (only relevant if they became a volunteer via donating; see
// getDonorDisplayName/source on the Volunteer model).
router.get("/mine", requireVolunteerAuth, getMyDonationsController);

// Public — a single donor downloading their own receipt right after
// paying, keyed by an unguessable Mongo ObjectId. No admin session
// exists at that point in the flow, so this can't be admin-gated
// (same reasoning as the volunteer ID-card download).
router.get("/:id/invoice", getDonationInvoiceController);

// Admin-gated from here down — these list/expose donor email, mobile,
// address, and PAN/GST across all donors, so they're not for public
// consumption.
router.get("/", requireAdminAuth, getAllDonationsController);
router.get("/:id", requireAdminAuth, getDonationByIdController);

export default router;