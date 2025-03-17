import type { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT s3_key FROM user_resumes WHERE user_id = $1 ORDER BY resume_id DESC LIMIT 1',
      [user_id]
    );
    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No resume found' });
    }

    const s3Key = result.rows[0].s3_key;
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: s3Key,
      }),
      { expiresIn: 3600 } // URL valid for 1 hour
    );

    res.status(200).json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}