import { Router } from "express";
import {
  getNewsUpdatesController,
  createNewsUpdateController,
  updateNewsUpdateController,
  deleteNewsUpdateController,
} from "../controllers/Newsupdate.controller.js";
// IMPORTANT: point this at whatever middleware already protects your
// gallery's POST/DELETE routes — the one that checks the
// `Authorization: Bearer <token>` header against what useAdminToken()
// reads on the frontend. That file wasn't shared with me, so this path
// is a guess — update it to match your real one rather than leaving two
// separate admin-auth implementations in the codebase.
import { requireAdminAuth } from "../middleware/Adminauth.middleware.js";

const router = Router();

router.get("/", getNewsUpdatesController);
router.post("/", requireAdminAuth, createNewsUpdateController);
router.put("/:id", requireAdminAuth, updateNewsUpdateController);
router.delete("/:id", requireAdminAuth, deleteNewsUpdateController);

export default router;