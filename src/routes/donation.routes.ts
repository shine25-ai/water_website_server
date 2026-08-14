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

const router = Router();

// IMPORTANT: static routes like /total-raised, /create-order, and
// /:id/invoice must be declared before the dynamic "/:id" route below,
// otherwise Express will treat "total-raised" (etc.) as an :id value and
// hit getDonationByIdController instead.
router.post("/", createDonationController);
router.post("/create-order", createDonationOrderController);
router.post("/verify-payment", verifyDonationPaymentController);
router.get("/total-raised", getTotalRaisedController);
router.get("/:id/invoice", getDonationInvoiceController);
router.get("/", getAllDonationsController);
router.get("/:id", getDonationByIdController);

export default router;