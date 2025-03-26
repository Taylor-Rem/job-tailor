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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const client = await pool.connect();
    const summaryRes = await client.query('SELECT summary FROM users.summary WHERE user_id = $1 LIMIT 1', [user_id]);
    const skillsRes = await client.query(`
      SELECT s.text 
      FROM users.skills_link sl 
      JOIN users.skills s ON sl.skill_id = s.id 
      WHERE sl.user_id = $1`, [user_id]);
    const experienceRes = await client.query(`
      SELECT e.title, e.description, e.start_date, e.end_date, c.name AS company 
      FROM users.experience e 
      LEFT JOIN public.companies c ON e.company_id = c.id 
      WHERE e.user_id = $1`, [user_id]);
    const educationRes = await client.query(`
      SELECT e.degree, e.start_date, e.end_date, s.name AS school 
      FROM users.education e 
      JOIN public.schools s ON e.school_id = s.id 
      WHERE e.user_id = $1`, [user_id]);
    const projectsRes = await client.query('SELECT title, description, date_completed, links FROM users.projects WHERE user_id = $1', [user_id]);
    client.release();

    res.status(200).json({
      summary: summaryRes.rows[0]?.summary || '',
      skills: skillsRes.rows.map(row => row.text),
      experience: experienceRes.rows,
      education: educationRes.rows,
      projects: projectsRes.rows.map(row => ({
        title: row.title,
        description: row.description,
        date_completed: row.date_completed,
        links: row.links // Already JSONB, no need to parse
      })),
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    res.status(500).json({ error: errorMessage });
  }
}