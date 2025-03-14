import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }, // Secure later
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, plan } = req.body;
  console.log(email, password, plan);
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const client = await pool.connect();
    const result = await client.query(
      'INSERT INTO users (email, password, plan) VALUES ($1, $2, $3) RETURNING user_id',
      [email, hashedPassword, plan]
    );
    client.release();
    res.status(200).json({ user_id: result.rows[0].user_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}