// pages/api/jobs/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import fetch from 'node-fetch'; // Add to package.json

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

const OPENCAGE_API_KEY = process.env.GEOCODE_API_KEY;

async function getLatLongFromZip(zip: string): Promise<{ lat: number; lng: number }> {
  const response = await fetch(
    `https://api.opencagedata.com/geocode/v1/json?q=${zip}&key=${OPENCAGE_API_KEY}&limit=1`
  );
  const data = await response.json() as { results: { geometry: { lat: number; lng: number } }[] };
  if (data.results.length === 0) throw new Error('Invalid zip code');
  const { lat, lng } = data.results[0].geometry;
  return { lat, lng };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { job_type, zip, radius } = req.query; // zip: "94105", radius: "50" (miles)

  try {
    const client = await pool.connect();
    let query = `
      SELECT id, title, company, description, url, locations, tags, remote, job_types, salary_range
      FROM jobs
      WHERE status = $1
    `;
    const params = ['open'];

    if (job_type) {
      query += ' AND job_types @> ARRAY[$2]::varchar[]';
      params.push(job_type as string);
    }

    if (zip && radius) {
      const { lat, lng } = await getLatLongFromZip(zip as string);
      const radiusMeters = parseFloat(radius as string) * 1609.34; // Miles to meters
      query += `
        AND EXISTS (
          SELECT 1
          FROM unnest(locations) AS loc
          WHERE earth_distance(
            ll_to_earth($${params.length + 1}, $${params.length + 2}),
            ll_to_earth((loc->>'Latitude')::float, (loc->>'Longitude')::float)
          ) <= $${params.length + 3}
        )
      `;
      params.push(lat, lng, radiusMeters);
    }

    const result = await client.query(query, params);
    client.release();

    res.status(200).json(result.rows);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    res.status(500).json({ error: errorMessage });
  }
}