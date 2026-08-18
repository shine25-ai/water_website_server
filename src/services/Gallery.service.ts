import fs from "fs";
import path from "path";
import GalleryPhoto from "../models/Gallery.model.js";
import type { IGalleryPhoto, GallerySection, GalleryStage } from "../models/Gallery.model.js";

const STAGES: GalleryStage[] = ["Before", "During", "After"];

export interface GalleryData {
  stagePhotos: Record<GalleryStage, IGalleryPhoto[]>;
  categoryPhotos: IGalleryPhoto[];
}

// Groups the flat collection into the shape Gallery.tsx renders:
// a Before/During/After map for Nallathangal 1.0, and a flat list
// (already carrying its own `category` field) for Nallathangal 2.0's
// filterable grid.
export const getGallery = async (): Promise<GalleryData> => {
  const photos = await GalleryPhoto.find().sort({ order: 1, createdAt: 1 });

  const stagePhotos: Record<GalleryStage, IGalleryPhoto[]> = {
    Before: [],
    During: [],
    After: [],
  };
  const categoryPhotos: IGalleryPhoto[] = [];

  for (const photo of photos) {
    if (photo.section === "nallathangal1" && photo.stage && STAGES.includes(photo.stage)) {
      stagePhotos[photo.stage].push(photo);
    } else if (photo.section === "nallathangal2") {
      categoryPhotos.push(photo);
    }
  }

  return { stagePhotos, categoryPhotos };
};

interface CreatePhotoInput {
  section: GallerySection;
  stage?: GalleryStage;
  category?: string;
  imageUrl: string;
  caption?: string;
}

export const createGalleryPhoto = async (input: CreatePhotoInput): Promise<IGalleryPhoto> => {
  return GalleryPhoto.create({
    section: input.section,
    stage: input.stage,
    category: input.category,
    imageUrl: input.imageUrl,
    caption: input.caption ?? "",
  });
};

// Best-effort: removes the DB record always; only tries to delete the
// underlying file if it's one of ours (served from /uploads), and never
// fails the request if the file is already gone.
export const deleteGalleryPhoto = async (id: string): Promise<IGalleryPhoto | null> => {
  const photo = await GalleryPhoto.findByIdAndDelete(id);
  if (photo?.imageUrl?.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), photo.imageUrl);
    fs.unlink(filePath, () => {
      /* ignore — DB record is already gone, an orphaned file isn't worth failing the request over */
    });
  }
  return photo;
};