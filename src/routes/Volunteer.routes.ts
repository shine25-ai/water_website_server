import { Router } from "express";
import multer from "multer";
import {
  createVolunteerController,
  getVolunteerIdCardController,
  getAllVolunteersController,
  setVolunteerPasswordController,
  volunteerLoginController,
  getVolunteerProfileController,
  updateVolunteerProfileController,
  uploadVolunteerPhotoController,
  removeVolunteerPhotoController,
  getVolunteerPhotoController,
} from "../controllers/Volunteer.controller.js";
import { requireVolunteerAuth } from "../middleware/volunteerAuth.middleware.js";
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

// IMPORTANT: static routes must be declared before "/:id/..." routes so
// Express doesn't treat a static segment as an :id value.
router.post("/auth/set-password", setVolunteerPasswordController);
router.post("/auth/login", volunteerLoginController);

router.get("/me", requireVolunteerAuth, getVolunteerProfileController);
router.put("/me", requireVolunteerAuth, updateVolunteerProfileController);
router.post("/me/photo", requireVolunteerAuth, upload.single("photo"), uploadVolunteerPhotoController);
router.get("/me/photo", requireVolunteerAuth, getVolunteerPhotoController);
router.delete("/me/photo", requireVolunteerAuth, removeVolunteerPhotoController);

// Public — a volunteer self-registering via the site form, not an admin.
router.post("/", upload.single("photo"), createVolunteerController);

// Admin-gated from here down — the full list and the ID-card PDF both
// expose name/email/mobile/village/district, so they're not for public
// consumption. (The self-registration flow above already streams the
// PDF straight back in its own response, so gating this endpoint doesn't
// block that — it only blocks unauthenticated *re*-downloads by id.)
router.get("/", requireAdminAuth, getAllVolunteersController);
router.get("/:id/id-card", requireAdminAuth, getVolunteerIdCardController);

export default router;