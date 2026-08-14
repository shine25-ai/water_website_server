import { Router } from "express";
import multer from "multer";
import {
  createVolunteerController,
  getVolunteerIdCardController,
  getAllVolunteersController,
} from "../controllers/Volunteer.controller.js";

const router = Router();

// Files are held in memory only, just long enough to hand the buffer off
// to S3 — nothing is ever written to local disk.
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

// IMPORTANT: static routes must be declared before "/:id/..." routes so
// Express doesn't treat a static segment as an :id value.
router.post("/", upload.single("photo"), createVolunteerController);
router.get("/", getAllVolunteersController);
router.get("/:id/id-card", getVolunteerIdCardController);

export default router;