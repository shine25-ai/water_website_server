import { S3Client } from "@aws-sdk/client-s3";

if (
  !process.env.AWS_REGION ||
  !process.env.AWS_S3_BUCKET ||
  !process.env.AWS_ACCESS_KEY_ID ||
  !process.env.AWS_SECRET_ACCESS_KEY
) {
  console.warn(
    "AWS S3 environment variables are not fully configured — photo uploads will fail."
  );
}

export const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

export const S3_BUCKET = process.env.AWS_S3_BUCKET as string;