import { Router } from "express";
import multer from "multer";
import {
  getFundraisingController,
  updateFundraisingController,
} from "../controllers/Fundraising.controller.js";
import { requireAdminAuth } from "../middleware/Adminauth.middleware.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB — banner photo runs larger than a headshot
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

// Public read — this is what the live site fetches to render the section.
router.get("/", getFundraisingController);

// Gated write — requires a valid admin session.
router.put("/", requireAdminAuth, upload.single("bannerPhoto"), updateFundraisingController);

export default router;