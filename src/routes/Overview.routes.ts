import { Router } from "express";
import multer from "multer";
import {
  getOverviewController,
  updateOverviewController,
} from "../controllers/Overview.controller.js";
import { requireAdminAuth } from "../middleware/Adminauth.middleware.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB — before/after photos run larger than a headshot
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

// Public read — this is what the live site fetches to render the section.
router.get("/", getOverviewController);

// Gated write — requires a valid admin session (see AdminAuth.middleware.ts).
router.put(
  "/",
  requireAdminAuth,
  upload.fields([
    { name: "beforePhoto", maxCount: 1 },
    { name: "afterPhoto", maxCount: 1 },
  ]),
  updateOverviewController
);

export default router;