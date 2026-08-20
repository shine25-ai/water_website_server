import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import jwt, { type SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];
const PASSWORD_SET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const hashPassword = async (plain: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
};

export const comparePassword = async (
  plain: string,
  hashed: string
): Promise<boolean> => {
  return bcrypt.compare(plain, hashed);
};

export const generatePasswordSetToken = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expires = new Date(Date.now() + PASSWORD_SET_TOKEN_TTL_MS);
  return { rawToken, hashedToken, expires };
};

export const hashRawToken = (rawToken: string): string => {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
};

export const signVolunteerToken = (volunteerId: string): string => {
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN };
  return jwt.sign({ volunteerId }, JWT_SECRET, options);
};

export const verifyVolunteerToken = (token: string): { volunteerId: string } => {
  return jwt.verify(token, JWT_SECRET) as { volunteerId: string };
};