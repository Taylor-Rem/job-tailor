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
      SELECT j.id, j.title, j.company, j.description, j.url,
             array_agg(
               jsonb_build_object(
                 'city_name', jl.city_name,
                 'latitude', jl.latitude,
                 'longitude', jl.longitude,
                 'country_code', jl.country_code,
                 'location_name', jl.location_name,
                 'country_subdivision_code', jl.country_subdivision_code
               )
             ) AS locations,
             js.min_salary, js.max_salary, js.interval_code,
             j.remote,
             array_agg(DISTINCT jt.tag) AS tags
      FROM jobs j
      JOIN jobs_salaries js ON j.salary_id = js.id
      LEFT JOIN jobs_locations_link jll ON j.id = jll.job_id
      LEFT JOIN jobs_locations jl ON jll.location_id = jl.id
      LEFT JOIN jobs_job_tags jjt ON j.id = jjt.job_id
      LEFT JOIN job_tags jt ON jjt.tag_id = jt.id
      WHERE j.status = $1
    `;
    const params = ['open'];
    let paramIndex = 2;

    if (job_type || tag) {
      const filterTag = job_type || tag;
      query += ` AND EXISTS (
        SELECT 1 FROM jobs_job_tags jjt2
        JOIN job_tags jt2 ON jjt2.tag_id = jt2.id
        WHERE jjt2.job_id = j.id AND jt2.tag = $${paramIndex}
      )`;
      params.push(filterTag as string);
      paramIndex++;
    }

    if (zip && radius) {
      const { lat, lng } = await getLatLongFromZip(zip as string);
      const radiusMeters = parseFloat(radius as string) * 1609.34;
      query += `
        AND EXISTS (
          SELECT 1 FROM jobs_locations_link jll2
          JOIN jobs_locations jl2 ON jll2.location_id = jl2.id
          WHERE jll2.job_id = j.id
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
      query += ` AND EXISTS (
        SELECT 1 FROM jobs_locations_link jll3
        JOIN jobs_locations jl3 ON jll3.location_id = jl3.id
        WHERE jll3.job_id = j.id
        AND (jl3.location_name = $${paramIndex} OR jl3.city_name = $${paramIndex})
      )`;
      params.push(location as string);
      paramIndex++;
    }

    query += `
      GROUP BY j.id, j.title, j.company, j.description, j.url,
               js.min_salary, js.max_salary, js.interval_code, j.remote
      ORDER BY j.id
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit.toString(), offset.toString());

    // Log the query for debugging
    const loggableQuery = query.split(/\$\d+/).reduce((acc, part, i) => {
      if (i >= params.length) return acc + part;
      const param = params[i];
      const formattedParam = param === null || param === undefined ? 'NULL' : typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` : param;
      return acc + part + formattedParam;
    }, '');
    console.log('Executable Query:', loggableQuery);

    // Build the count query with the same filters
    let countQuery = `SELECT COUNT(DISTINCT j.id) FROM jobs j
      LEFT JOIN jobs_locations_link jll ON j.id = jll.job_id
      LEFT JOIN jobs_locations jl ON jll.location_id = jl.id
      LEFT JOIN jobs_job_tags jjt ON j.id = jjt.job_id
      LEFT JOIN job_tags jt ON jjt.tag_id = jt.id
      WHERE j.status = $1`;
    const countParams = ['open'];
    let countParamIndex = 2;

    if (job_type || tag) {
      const filterTag = job_type || tag;
      countQuery += ` AND EXISTS (
        SELECT 1 FROM jobs_job_tags jjt2
        JOIN job_tags jt2 ON jjt2.tag_id = jt2.id
        WHERE jjt2.job_id = j.id AND jt2.tag = $${countParamIndex}
      )`;
      countParams.push(filterTag as string);
      countParamIndex++;
    }

    if (zip && radius) {
      const { lat, lng } = await getLatLongFromZip(zip as string);
      const radiusMeters = parseFloat(radius as string) * 1609.34;
      countQuery += `
        AND EXISTS (
          SELECT 1 FROM jobs_locations_link jll2
          JOIN jobs_locations jl2 ON jll2.location_id = jl2.id
          WHERE jll2.job_id = j.id
          AND earth_distance(
            ll_to_earth($${countParamIndex}, $${countParamIndex + 1}),
            ll_to_earth(jl2.latitude, jl2.longitude)
          ) <= $${countParamIndex + 2}
        )`;
      countParams.push(lat.toString(), lng.toString(), radiusMeters.toString());
      countParamIndex += 3;
    }

    if (location) {
      countQuery += ` AND EXISTS (
        SELECT 1 FROM jobs_locations_link jll3
        JOIN jobs_locations jl3 ON jll3.location_id = jl3.id
        WHERE jll3.job_id = j.id
        AND (jl3.location_name = $${countParamIndex} OR jl3.city_name = $${countParamIndex})
      )`;
      countParams.push(location as string);
      countParamIndex++;
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