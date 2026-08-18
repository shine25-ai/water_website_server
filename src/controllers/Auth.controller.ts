import type { Request, Response } from "express";
import jwt from "jsonwebtoken";

// Single-admin login. Credentials live in env vars — ADMIN_USERNAME and
// ADMIN_PASSWORD as plain text. On success, issues a signed JWT the
// client attaches as `Authorization: Bearer <token>` on write requests.
export const loginController = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body ?? {};

    if (!username || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Username and password are required." });
    }

    const expectedUsername = process.env.ADMIN_USERNAME;
    const expectedPassword = process.env.ADMIN_PASSWORD;
    const jwtSecret = process.env.JWT_SECRET;

    if (!expectedUsername || !expectedPassword || !jwtSecret) {
      console.error("Admin auth env vars are not fully configured.");
      return res
        .status(500)
        .json({ success: false, message: "Admin auth is not configured on the server." });
    }

    if (username !== expectedUsername || password !== expectedPassword) {
      return res.status(401).json({ success: false, message: "Invalid username or password." });
    }

    const token = jwt.sign({ sub: username, role: "admin" }, jwtSecret, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    } as jwt.SignOptions);

    return res.status(200).json({ success: true, token });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};