import sharp from "sharp";

// The volunteer ID card only ever shows the photo at ~84x84pt inside a
// circle, so there's no reason to upload or embed a multi-megabyte
// original.
export const resizeForIdCard = async (buffer: Buffer): Promise<Buffer> => {
  return await sharp(buffer)
    .resize(500, 500, { fit: "cover" })
    .jpeg({ quality: 82 })
    .toBuffer();
};

// Content photos (e.g. the overview section's before/after dam images)
// are displayed larger, so this keeps proportions instead of cropping
// to a square, just caps the width so a huge phone photo doesn't ship
// to every visitor at full resolution.
export const resizeForContentImage = async (
  buffer: Buffer,
  maxWidth = 1200
): Promise<Buffer> => {
  return await sharp(buffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
};