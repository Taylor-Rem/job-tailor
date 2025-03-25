import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import puppeteer from 'puppeteer';
import elegantTheme from 'jsonresume-theme-elegant';
import { tailorResume } from './tailorResume';

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user_id, job_id } = req.body;
  if (!user_id || !job_id) return res.status(400).json({ error: 'user_id and job_id required' });

  try {
    const client = await pool.connect();
    const resumeResult = await client.query(
      'SELECT header, summary, experience, education FROM user_resumes WHERE user_id = $1 ORDER BY uploaded_at DESC LIMIT 1',
      [user_id]
    );
    if (!resumeResult.rows.length) throw new Error('No resume found');
    const { header, summary, experience, education } = resumeResult.rows[0];
    const resumeId = resumeResult.rows[0].resume_id;

    const skillsResult = await client.query(
      `SELECT s.skill_name
       FROM skills s
       JOIN resume_skills rs ON s.skill_id = rs.skill_id
       WHERE rs.resume_id = $1`,
      [resumeId]
    );
    const skills = skillsResult.rows.map(row => row.skill_name);

    const jobResult = await client.query('SELECT description FROM jobs WHERE id = $1', [job_id]);
    if (!jobResult.rows.length) throw new Error('Job not found');
    const jobDescription = jobResult.rows[0].description;
    client.release();

    const tailoredData = await tailorResume(summary || '', skills, jobDescription);
    console.log('Tailored data:', tailoredData);

    const resumeData = {
      basics: {
        name: header.name || 'Applicant',
        email: header.email || '',
        phone: header.phone || '',
        url: header.links?.[0] || '',
        location: {
          address: header.address || '',
          postalCode: '',
          city: '',
          countryCode: '',
          region: '',
        },
      },
      summary: tailoredData.summary || '',
      skills: tailoredData.skills || [],
      work: experience || [],
      education: education || [],
    };
    console.log('Resume data for rendering:', resumeData);

    const html = elegantTheme.render(resumeData);
    console.log('Generated HTML:', html.slice(0, 500) + '...');

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html);
    const pdfBuffer = await page.pdf({ format: 'Letter', printBackground: true });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${user_id}_${job_id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    console.error('Handler error:', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
}