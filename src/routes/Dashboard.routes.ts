import { Router } from "express";
import {
  getDashboardController,
  updateDashboardController,
} from "../controllers/Dashboard.controller.js";
import { requireAdminAuth } from "../middleware/Adminauth.middleware.js";

const router = Router();

// Public read — this is what the live site fetches to render the section.
router.get("/", getDashboardController);

// Gated write — requires a valid admin session, same as Overview/Fundraising.
router.put("/", requireAdminAuth, updateDashboardController);

export default router;