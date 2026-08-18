import mongoose, { Document, Schema } from "mongoose";

export interface INewsUpdate extends Document {
  date: string;
  title: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const newsUpdateSchema = new Schema<INewsUpdate>(
  {
    // Free-text date label rather than a real Date — the site publishes
    // placeholder entries like "XX Sep 2026" before an exact day is
    // confirmed, which a Date field can't represent.
    date: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    // Higher order shows first on the public timeline. New entries default
    // to one more than the current highest (so they land on top), but the
    // field stays editable so an admin can reorder without touching the
    // date label.
    order: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<INewsUpdate>("NewsUpdate", newsUpdateSchema);