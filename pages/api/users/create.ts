import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, username, plan } = req.body;
  if (!email || !password || !username) {
    return res.status(400).json({ error: 'Email, password, and username are required' });
  }

  try {
    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO users.users (email, password, username, plan) VALUES ($1, $2, $3, $4) RETURNING user_id',
        [email, hashedPassword, username, plan]
      );
      res.status(200).json({ user_id: result.rows[0].user_id });
    } catch (err) {
      // Handle unique constraint violations
      if ((err as any).code === '23505') { // PostgreSQL unique violation
        const detail = (err as any).detail;
        if (detail.includes('email')) {
          res.status(400).json({ error: 'Email already exists' });
        } else if (detail.includes('username')) {
          res.status(400).json({ error: 'Username already taken' });
        } else {
          res.status(500).json({ error: 'Duplicate entry' });
        }
      } else {
        res.status(500).json({ error: (err as Error).message });
      }
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}