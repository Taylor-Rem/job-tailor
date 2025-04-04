// lib/s3.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID!,
    secretAccessKey: process.env.SECRET_ACCESS_KEY!,
  },
});

export async function uploadToS3(user_id: number, file_name: string, pdfBuffer: Buffer) {
  if (!process.env.S3_BUCKET) throw new Error('S3_BUCKET environment variable is not set');
  
  const s3Key = `${user_id}/${Date.now()}/${file_name}`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    })
  );
  return s3Key;
}

export async function deleteFromS3(s3Key: string) {
  if (!process.env.S3_BUCKET) throw new Error('S3_BUCKET environment variable is not set');
  
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
    })
  );
}