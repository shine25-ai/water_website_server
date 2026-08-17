import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { s3Client, S3_BUCKET } from "../config/S3.config.js";

interface UploadResult {
  key: string;
}

export const uploadBufferToS3 = async (
  buffer: Buffer,
  _originalName: string,
  _mimetype: string
): Promise<UploadResult> => {
  // Normalize every uploaded photo to PNG regardless of source format
  // (JPEG, WEBP, HEIC from iPhones, etc). pdfkit — used later to render
  // the volunteer ID card — only understands JPEG and PNG, so converting
  // once here guarantees every stored photo is safe to place on the card,
  // instead of failing at PDF-generation time with "Unknown image format".
  const normalizedBuffer = await sharp(buffer)
    .rotate() // respect EXIF orientation before flattening to PNG
    .png()
    .toBuffer();

  const key = `volunteers/${randomUUID()}.png`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: normalizedBuffer,
      ContentType: "image/png",
    })
  );

  return { key };
};

export const getBufferFromS3 = async (key: string): Promise<Buffer> => {
  const result = await s3Client.send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key })
  );

  const stream = result.Body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};