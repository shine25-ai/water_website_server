import mongoose, { Document as MongooseDocument, Schema } from "mongoose";

export interface IDocumentRecord extends MongooseDocument {
  // Tamil group label, e.g. "சட்ட ஆவணங்கள்" — the public site groups
  // documents by this exact string, in order of first appearance, so
  // reusing the same label across multiple docs groups them together
  // automatically. No separate "groups" collection needed.
  group: string;
  ta: string;
  en: string;
  icon: string; // key into the frontend's ICON_MAP
  fileKey: string;
  fileUrl: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const documentRecordSchema = new Schema<IDocumentRecord>(
  {
    group: { type: String, required: true, trim: true },
    ta: { type: String, required: true, trim: true },
    en: { type: String, required: true, trim: true },
    icon: { type: String, required: true, trim: true, default: "file-text" },
    fileKey: { type: String, required: true },
    fileUrl: { type: String, required: true },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<IDocumentRecord>("DocumentRecord", documentRecordSchema);