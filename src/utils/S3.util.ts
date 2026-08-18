import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import * as path from "path";
import { s3Client, S3_BUCKET } from "../config/S3.config.js";

// Builds a random, collision-free S3 key without touching S3 itself —
// splitting key generation out from the upload lets the caller create the
// DB record and kick off the S3 PUT at the same time, instead of
// waiting on S3 before it even knows what key to save.
export const buildS3Key = (originalName: string, folder = "uploads"): string => {
  return `${folder}/${randomUUID()}${path.extname(originalName) || ".jpg"}`;
};

export const uploadBufferToS3 = async (
  key: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> => {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );
};

// Streams an object back out of S3 as a Buffer — for cases (like the
// volunteer ID card re-download) where the server needs the raw bytes
// rather than a URL.
export const getBufferFromS3 = async (key: string): Promise<Buffer> => {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key })
  );

  const stream = response.Body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

// Short-lived signed URL — for private objects (e.g. volunteer photos)
// that need to be viewed in a browser without making the bucket public.
export const getSignedPhotoUrl = async (
  key: string,
  expiresInSeconds = 3600
): Promise<string> => {
  const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
};

// Direct, permanent URL for objects meant to be publicly readable (e.g.
// the overview section's before/after photos) — requires a bucket policy
// that allows public GetObject on the relevant prefix; see setup notes.
// Does NOT rely on object ACLs, since most buckets created after ~2023
// have "Bucket owner enforced" on and reject ACLs outright.
export const getPublicS3Url = (key: string): string => {
  return `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

// Recovers the S3 key from a URL produced by getPublicS3Url above —
// needed when deleting a photo, since the DB only stores the URL, not
// the raw key. Returns null if the URL doesn't match that shape (e.g.
// it's a signed URL or points somewhere else entirely).
export const keyFromS3Url = (url: string): string | null => {
  const base = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
  return url.startsWith(base) ? url.slice(base.length) : null;
};

export const deleteFromS3 = async (key: string): Promise<void> => {
  await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
};