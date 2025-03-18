// pages/api/resumes/upload.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Pool } from 'pg';

const s3 = new S3Client({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID!,
    secretAccessKey: process.env.SECRET_ACCESS_KEY!,
  },
});

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user_id, resume, file_name } = req.body;
  if (!user_id || !resume || !file_name) {
    return res.status(400).json({ error: 'user_id, resume, and file_name required' });
  }

  const buffer = Buffer.from(resume, 'base64');
  const s3Key = `resumes/${user_id}/${file_name}`;

  try {
    // Upload to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: 'application/pdf',
      })
    );

    // Store metadata in RDS
    const client = await pool.connect();
    const result = await client.query(
      'INSERT INTO user_resumes (user_id, s3_key, file_name) VALUES ($1, $2, $3) RETURNING resume_id',
      [user_id, s3Key, file_name]
    );
    client.release();

    res.status(200).json({ resume_id: result.rows[0].resume_id });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    res.status(500).json({ error: errorMessage });
  }
}