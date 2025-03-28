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
  const { user_id } = req.body;

  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const client = await pool.connect();

    if (req.method === 'POST') {
      // Fetch user info (unchanged)
      const userInfoRes = await client.query(
        'SELECT fname, lname, contact_email AS email, phone_number AS phone, l.city, l.state FROM users.user_info ui LEFT JOIN public.locations l ON ui.location_id = l.id WHERE ui.user_id = $1',
        [user_id]
      );
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
        SELECT s.name AS school, e.url, e.area, e.study_type, e.start_date, e.end_date 
        FROM users.education e 
        JOIN public.schools s ON e.school_id = s.id 
        WHERE e.user_id = $1`, [user_id]);
      const projectsRes = await client.query('SELECT title, description, date_completed, links, roles FROM users.projects WHERE user_id = $1', [user_id]);

      client.release();

      const userInfo = userInfoRes.rows[0] || {};
      res.status(200).json({
        fname: userInfo.fname || '',
        lname: userInfo.lname || '',
        email: userInfo.email || '',
        phone: userInfo.phone || '',
        city: userInfo.city || '',
        state: userInfo.state || '',
        summary: summaryRes.rows[0]?.summary || '',
        skills: skillsRes.rows.map(row => row.text),
        experience: experienceRes.rows,
        education: educationRes.rows,
        projects: projectsRes.rows,
      });
    } else if (req.method === 'PUT') {
      await client.query('BEGIN');

      const { fname, lname, email, phone, city, state, summary, skills, experience, education, projects } = req.body;

      // Update user_info
      let locationId = null;
      if (city) {
        const locationResult = await client.query(`
          INSERT INTO public.locations (city, state, country, created_at, updated_at)
          VALUES ($1, $2, 'US', NOW(), NOW())
          ON CONFLICT (city, country) DO UPDATE SET
            state = EXCLUDED.state,
            updated_at = NOW()
          RETURNING id
        `, [city, state || null]);
        locationId = locationResult.rows[0].id;
      }

      const updateResult = await client.query(`
        INSERT INTO users.user_info (user_id, fname, lname, contact_email, phone_number, location_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO UPDATE SET
          fname = EXCLUDED.fname,
          lname = EXCLUDED.lname,
          contact_email = EXCLUDED.contact_email,
          phone_number = EXCLUDED.phone_number,
          location_id = EXCLUDED.location_id,
          updated_at = NOW()
        RETURNING fname, lname, contact_email AS email, phone_number AS phone, location_id
      `, [user_id, fname || '', lname || '', email || '', phone || '', locationId]);

      // Update summary
      if (summary) {
        await client.query('DELETE FROM users.summary WHERE user_id = $1', [user_id]);
        await client.query('INSERT INTO users.summary (user_id, summary) VALUES ($1, $2)', [user_id, summary]);
      }

      // Update skills
      await client.query('DELETE FROM users.skills_link WHERE user_id = $1', [user_id]);
      for (const skill of skills || []) {
        const skillResult = await client.query(`
          INSERT INTO users.skills (text, created_at) 
          VALUES ($1, NOW()) 
          ON CONFLICT (text) DO UPDATE SET created_at = EXCLUDED.created_at 
          RETURNING id
        `, [skill]);
        await client.query('INSERT INTO users.skills_link (user_id, skill_id) VALUES ($1, $2)', [user_id, skillResult.rows[0].id]);
      }

      // Update experience
      await client.query('DELETE FROM users.experience WHERE user_id = $1', [user_id]);
      for (const exp of experience || []) {
        let companyId = null;
        if (exp.company) {
          const companyResult = await client.query(`
            INSERT INTO public.companies (name, created_at, updated_at)
            VALUES ($1, NOW(), NOW())
            ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
            RETURNING id
          `, [exp.company]);
          companyId = companyResult.rows[0].id;
        }
        await client.query(`
          INSERT INTO users.experience (user_id, company_id, title, description, start_date, end_date)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [user_id, companyId, exp.title, exp.description, exp.start_date, exp.end_date || null]);
      }

      // Update education
      await client.query('DELETE FROM users.education WHERE user_id = $1', [user_id]);
      for (const edu of education || []) {
        const schoolResult = await client.query(`
          INSERT INTO public.schools (name, created_at, updated_at)
          VALUES ($1, NOW(), NOW())
          ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
          RETURNING id
        `, [edu.school]);
        await client.query(`
          INSERT INTO users.education (user_id, school_id, url, area, study_type, start_date, end_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [user_id, schoolResult.rows[0].id, edu.url || null, edu.area || null, edu.study_type || null, edu.start_date, edu.end_date || null]);
      }

      // Update projects
      await client.query('DELETE FROM users.projects WHERE user_id = $1', [user_id]);
      for (const proj of projects || []) {
        const links = proj.links ? proj.links.split(',').reduce((acc: any, link: string) => {
          const trimmed = link.trim();
          return trimmed ? { ...acc, [new URL(trimmed).hostname]: trimmed } : acc;
        }, {}) : {};
        const roles = proj.roles ? proj.roles.split(',').map((role: string) => role.trim()) : ['Contributor'];
        await client.query(`
          INSERT INTO users.projects (user_id, title, description, date_completed, links, roles)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [user_id, proj.title, proj.description, proj.date_completed || null, JSON.stringify(links), roles]);
      }

      await client.query('COMMIT');

      const updatedLocation = locationId ? await client.query(
        'SELECT city, state FROM public.locations WHERE id = $1',
        [locationId]
      ) : { rows: [{ city: '', state: '' }] };

      client.release();

      const updatedInfo = updateResult.rows[0];
      res.status(200).json({
        fname: updatedInfo.fname,
        lname: updatedInfo.lname,
        email: updatedInfo.email,
        phone: updatedInfo.phone,
        city: updatedLocation.rows[0].city,
        state: updatedLocation.rows[0].state,
      });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    res.status(500).json({ error: errorMessage });
  }
}