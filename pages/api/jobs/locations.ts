import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const client = await pool.connect();
    const query = `
      SELECT DISTINCT COALESCE(location_name, city_name) AS location
      FROM jobs_locations
      WHERE location_name IS NOT NULL OR city_name IS NOT NULL
      ORDER BY location;
    `;
    const result = await client.query(query);
    client.release();

    const locations = result.rows.map((row) => row.location);
    res.status(200).json(locations);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    res.status(500).json({ error: errorMessage });
  }
}