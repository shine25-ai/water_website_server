import mongoose, { Document, Schema } from "mongoose";

export interface IGoal {
  icon: string; // key into the frontend's ICON_MAP (e.g. "tree-pine") — never raw CSS classes
  label: string;
}

export interface IOverviewContent extends Document {
  slug: string;
  sectionTitle: string;
  sectionSubtitle: string;
  goals: IGoal[];
  transformationBadge: string;
  beforeLabel: string;
  beforeCaption: string;
  beforeImageKey?: string;
  beforeImageUrl?: string;
  afterLabel: string;
  afterImageKey?: string;
  afterImageUrl?: string;
  checklistTitle: string;
  checklist: string[];
  createdAt: Date;
  updatedAt: Date;
}

const goalSchema = new Schema<IGoal>(
  {
    icon: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const overviewContentSchema = new Schema<IOverviewContent>(
  {
    // This collection only ever holds one document. A fixed, unique slug
    // (rather than "just take the first document") makes the singleton
    // intent explicit and lets updates use a safe upsert.
    slug: { type: String, required: true, unique: true, default: "overview" },
    sectionTitle: { type: String, required: true, trim: true },
    sectionSubtitle: { type: String, trim: true },
    goals: { type: [goalSchema], default: [] },
    transformationBadge: { type: String, trim: true },
    beforeLabel: { type: String, trim: true },
    beforeCaption: { type: String, trim: true },
    beforeImageKey: { type: String },
    beforeImageUrl: { type: String },
    afterLabel: { type: String, trim: true },
    afterImageKey: { type: String },
    afterImageUrl: { type: String },
    checklistTitle: { type: String, trim: true },
    checklist: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model<IOverviewContent>(
  "OverviewContent",
  overviewContentSchema
);