import { Router } from "express";
import { loginController } from "../controllers/Auth.controller.js";

const router = Router();

router.post("/login", loginController);

export default router;