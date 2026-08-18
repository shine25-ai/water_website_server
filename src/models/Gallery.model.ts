import mongoose, { Document, Schema } from "mongoose";

export type GallerySection = "nallathangal1" | "nallathangal2";
export type GalleryStage = "Before" | "During" | "After";

export interface IGalleryPhoto extends Document {
  section: GallerySection;
  // Required when section === "nallathangal1" — which timeline stage
  // this photo belongs to (matches the Before/During/After toggle).
  stage?: GalleryStage;
  // Required when section === "nallathangal2" — matches one of the
  // CATEGORIES names on the frontend (e.g. "Desilting", "Volunteers").
  // Kept as a free-text string rather than an enum so admins can add
  // new categories later without a migration.
  category?: string;
  imageUrl: string;
  caption: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const galleryPhotoSchema = new Schema<IGalleryPhoto>(
  {
    section: { type: String, enum: ["nallathangal1", "nallathangal2"], required: true },
    stage: { type: String, enum: ["Before", "During", "After"] },
    category: { type: String, trim: true },
    imageUrl: { type: String, required: true },
    caption: { type: String, trim: true, default: "" },
    // Lets the admin control display order within a stage/category later;
    // defaults to 0 so newest-first-by-createdAt still works untouched.
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Reject a photo that's missing the field its section requires, instead
// of silently landing in neither the stage grid nor the category grid.
// Using the no-callback style (throw instead of next(err)) avoids a
// next()-signature typing conflict some Mongoose/TS version pairs hit
// with the callback-based pre-hook overload.
galleryPhotoSchema.pre("validate", function () {
  if (this.section === "nallathangal1" && !this.stage) {
    throw new Error("stage is required for Nallathangal 1.0 photos");
  }
  if (this.section === "nallathangal2" && !this.category) {
    throw new Error("category is required for Nallathangal 2.0 photos");
  }
});

galleryPhotoSchema.index({ section: 1, stage: 1, category: 1, order: 1 });

export default mongoose.model<IGalleryPhoto>("GalleryPhoto", galleryPhotoSchema);

