import mongoose, { Document, Schema } from "mongoose";

export const LEADER_ROLES = ["leader", "co-leader", "representative"] as const;
export type LeaderRole = (typeof LEADER_ROLES)[number];

export interface ILeader extends Document {
  name: string;
  role: LeaderRole;
  designation?: string; // e.g. "Founder & Chairman"
  location?: string; // e.g. "Dharapuram" — mostly for representatives
  bio?: string;
  // S3 object key (e.g. "leaders/<uuid>.jpg") — not a public URL.
  photoKey?: string;
  order: number; // lower = shown first within its role group
  createdAt: Date;
  updatedAt: Date;
}

const leaderSchema = new Schema<ILeader>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    role: { type: String, required: true, trim: true, maxlength: 60 },
    designation: { type: String, trim: true, maxlength: 100 },
    location: { type: String, trim: true, maxlength: 100 },
    bio: { type: String, trim: true, maxlength: 400 },
    photoKey: { type: String },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<ILeader>("Leader", leaderSchema);