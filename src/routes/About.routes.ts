import { Router } from "express";
import multer from "multer";
import {
  getAboutPublicController,
  updateAboutContentController,
  createLeaderController,
  updateLeaderController,
  deleteLeaderController,
} from "../controllers/About.controller.js";
import { requireAdminAuth } from "../middleware/Adminauth.middleware.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

// Public — About page text + leaders (photos as short-lived signed URLs).
router.get("/", getAboutPublicController);

// Admin-gated
router.put("/content", requireAdminAuth, updateAboutContentController);
router.post("/leaders", requireAdminAuth, upload.single("photo"), createLeaderController);
router.put("/leaders/:id", requireAdminAuth, upload.single("photo"), updateLeaderController);
router.delete("/leaders/:id", requireAdminAuth, deleteLeaderController);

export default router;