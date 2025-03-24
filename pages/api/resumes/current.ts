import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

const s3 = new S3Client({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID!,
    secretAccessKey: process.env.SECRET_ACCESS_KEY!,
  },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT resume_id, s3_key FROM user_resumes WHERE user_id = $1', [user_id]);
    client.release();
    if (result.rows.length > 0) {
      const { resume_id, s3_key } = result.rows[0];
      const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: s3_key,
      });
      const s3Url = await getSignedUrl(s3, command, { expiresIn: 3600 });
      res.status(200).json({ resume_id, s3Url });
    } else {
      res.status(200).json({ resume_id: null, s3_url: null });
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    res.status(500).json({ error: errorMessage });
  }
}