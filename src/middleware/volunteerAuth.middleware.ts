import type { Request, Response, NextFunction } from "express";
import { verifyVolunteerToken } from "../utils/volunteerAuth.util.js";

export interface AuthenticatedVolunteerRequest extends Request {
  volunteerId?: string;
}

export const requireVolunteerAuth = (
  req: AuthenticatedVolunteerRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyVolunteerToken(token);
    req.volunteerId = decoded.volunteerId;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired session" });
  }
};