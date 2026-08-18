import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Gates the CMS write endpoints. Expects `Authorization: Bearer <token>`,
// where the token was issued by loginController after a valid
// username/password check. Replaces the old static ADMIN_KEY check.
export const requireAdminAuth = (req: Request, res: Response, next: NextFunction) => {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error("JWT_SECRET is not set in the server environment.");
    return res.status(500).json({
      success: false,
      message: "Admin auth is not configured on the server.",
    });
  }

  const authHeader = req.header("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ success: false, message: "Not logged in." });
  }

  try {
    jwt.verify(token, jwtSecret);
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
  }
};