import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import fetch from 'node-fetch';

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

  const { job_type, zip, radius, location, tag, page = '1' } = req.query;
  const limit = 50;
  const offset = (parseInt(page as string) - 1) * limit;

  try {
    const client = await pool.connect();
    let query = `
      SELECT j.id, j.title, c.name AS company, j.description, j.url,
             array_agg(
               jsonb_build_object(
                 'city', jl.city,
                 'state', jl.state,
                 'country', jl.country,
                 'zip_code', jl.zip_code,
                 'latitude', jl.latitude,
                 'longitude', jl.longitude
               )
             ) AS locations,
             s.min_amount, s.max_amount, s.currency,
             j.remote,
             array_agg(DISTINCT t.name) AS tags
      FROM jobs.jobs j
      JOIN public.companies c ON j.company_id = c.id
      JOIN jobs.salaries s ON j.salary_id = s.id
      LEFT JOIN jobs.locations_link jl_link ON j.id = jl_link.job_id
      LEFT JOIN public.locations jl ON jl_link.location_id = jl.id
      LEFT JOIN jobs.tags_link jt_link ON j.id = jt_link.job_id
      LEFT JOIN public.tags t ON jt_link.tag_id = t.id
      WHERE j.status = $1
    `;
    const params = ['open'];
    let paramIndex = 2;

    if (job_type || tag) {
      const filterTag = job_type || tag;
      query += ` AND EXISTS (
        SELECT 1 FROM jobs.tags_link jt_link2
        JOIN public.tags t2 ON jt_link2.tag_id = t2.id
        WHERE jt_link2.job_id = j.id AND t2.name = $${paramIndex}
      )`;
      params.push(filterTag as string);
      paramIndex++;
    }

    if (zip && radius) {
      const { lat, lng } = await getLatLongFromZip(zip as string);
      const radiusMeters = parseFloat(radius as string) * 1609.34;
      query += `
        AND EXISTS (
          SELECT 1 FROM jobs.locations_link jl_link2
          JOIN public.locations jl2 ON jl_link2.location_id = jl2.id
          WHERE jl_link2.job_id = j.id
          AND jl2.latitude IS NOT NULL AND jl2.longitude IS NOT NULL
          AND earth_distance(
            ll_to_earth($${paramIndex}, $${paramIndex + 1}),
            ll_to_earth(jl2.latitude, jl2.longitude)
          ) <= $${paramIndex + 2}
        )
      `;
      params.push(lat.toString(), lng.toString(), radiusMeters.toString());
      paramIndex += 3;
    }

    if (location) {
      const [city, state] = [(location as string).split(' ').slice(0, -1).join(' '), (location as string).split(' ').pop()];
      query += ` AND EXISTS (
        SELECT 1 FROM jobs.locations_link jl_link3
        JOIN public.locations jl3 ON jl_link3.location_id = jl3.id
        WHERE jl_link3.job_id = j.id
        AND (jl3.city = $${paramIndex} OR jl3.state = $${paramIndex + 1})
      )`;
      params.push(city, state || 'null');
      paramIndex += 2;
    }

    query += `
      GROUP BY j.id, j.title, c.name, j.description, j.url,
               s.min_amount, s.max_amount, s.currency, j.remote
      ORDER BY j.id
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit.toString(), offset.toString());

    let countQuery = `
      SELECT COUNT(DISTINCT j.id)
      FROM jobs.jobs j
      LEFT JOIN jobs.locations_link jl_link ON j.id = jl_link.job_id
      LEFT JOIN public.locations jl ON jl_link.location_id = jl.id
      LEFT JOIN jobs.tags_link jt_link ON j.id = jt_link.job_id
      LEFT JOIN public.tags t ON jt_link.tag_id = t.id
      WHERE j.status = $1
    `;
    const countParams = ['open'];
    let countParamIndex = 2;

    if (job_type || tag) {
      const filterTag = job_type || tag;
      countQuery += ` AND EXISTS (
        SELECT 1 FROM jobs.tags_link jt_link2
        JOIN public.tags t2 ON jt_link2.tag_id = t2.id
        WHERE jt_link2.job_id = j.id AND t2.name = $${countParamIndex}
      )`;
      countParams.push(filterTag as string);
      countParamIndex++;
    }

    if (zip && radius) {
      const { lat, lng } = await getLatLongFromZip(zip as string);
      const radiusMeters = parseFloat(radius as string) * 1609.34;
      countQuery += `
        AND EXISTS (
          SELECT 1 FROM jobs.locations_link jl_link2
          JOIN public.locations jl2 ON jl_link2.location_id = jl2.id
          WHERE jl_link2.job_id = j.id
          AND jl2.latitude IS NOT NULL AND jl2.longitude IS NOT NULL
          AND earth_distance(
            ll_to_earth($${countParamIndex}, $${countParamIndex + 1}),
            ll_to_earth(jl2.latitude, jl2.longitude)
          ) <= $${countParamIndex + 2}
        )`;
      countParams.push(lat.toString(), lng.toString(), radiusMeters.toString());
      countParamIndex += 3;
    }

    if (location) {
      const [city, state] = [(location as string).split(' ').slice(0, -1).join(' '), (location as string).split(' ').pop()];
      countQuery += ` AND EXISTS (
        SELECT 1 FROM jobs.locations_link jl_link3
        JOIN public.locations jl3 ON jl_link3.location_id = jl3.id
        WHERE jl_link3.job_id = j.id
        AND (jl3.city = $${countParamIndex} OR jl3.state = $${countParamIndex + 1})
      )`;
      countParams.push(city, state || 'null');
      countParamIndex += 2;
    }


    const result = await client.query(query, params);
    const totalResult = await client.query(countQuery, countParams);
    client.release();

    res.status(200).json({
      jobs: result.rows,
      total: parseInt(totalResult.rows[0].count),
      page: parseInt(page as string),
      totalPages: Math.ceil(parseInt(totalResult.rows[0].count) / limit),
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    res.status(500).json({ error: errorMessage });
  }
}