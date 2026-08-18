import { Router } from "express";
import multer from "multer";
import {
  getAllDocumentsController,
  createDocumentController,
  updateDocumentController,
  deleteDocumentController,
  downloadDocumentController,
} from "../controllers/Document.controller.js";
import { requireAdminAuth } from "../middleware/Adminauth.middleware.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB — PDFs run larger than photos
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed"));
    }
    cb(null, true);
  },
});

// Public read — this is what the live site fetches to render the section.
router.get("/", getAllDocumentsController);

// Public download — streams the PDF with an attachment header. No auth,
// since anyone visiting the site should be able to download these.
router.get("/:id/download", downloadDocumentController);

// Gated writes — require a valid admin session.
router.post("/", requireAdminAuth, upload.single("file"), createDocumentController);
router.put("/:id", requireAdminAuth, upload.single("file"), updateDocumentController);
router.delete("/:id", requireAdminAuth, deleteDocumentController);

export default router;