import { Router } from "express";
import multer from "multer";
import {
  getGalleryController,
  addGalleryPhotoController,
  deleteGalleryPhotoController,
} from "../controllers/Gallery.controller.js";
import { requireAdminAuth } from "../middleware/Adminauth.middleware.js";

const router = Router();

// Memory storage — NOT disk storage. The controller uploads straight to
// S3 via file.buffer, so the file must never be written to local disk
// first; diskStorage leaves req.file.buffer undefined, which silently
// uploads an empty object to S3 (this was the cause of the broken
// thumbnails — photos "succeeded" but were 0 bytes on S3).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per photo
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

// Public read — this is what the live site fetches to render the gallery.
router.get("/", getGalleryController);

// Gated write — requires a valid admin session, same as Overview/Fundraising.
router.post("/", requireAdminAuth, upload.single("photo"), addGalleryPhotoController);
router.delete("/:id", requireAdminAuth, deleteGalleryPhotoController);

export default router;