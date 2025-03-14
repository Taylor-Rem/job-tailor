import type { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Pool } from 'pg';

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
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

  const { user_id, resume } = req.body; // resume is base64 string
  if (!user_id || !resume) return res.status(400).json({ error: 'user_id and resume required' });

  const buffer = Buffer.from(resume, 'base64');
  const s3Key = `resumes/${user_id}/original.pdf`;

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
      'INSERT INTO user_resumes (user_id, s3_key) VALUES ($1, $2) RETURNING resume_id',
      [user_id, s3Key]
    );
    client.release();

    res.status(200).json({ resume_id: result.rows[0].resume_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}