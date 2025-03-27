import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import puppeteer from 'puppeteer';
import elegantTheme from 'jsonresume-theme-elegant';
import { tailorResume } from './tailorResume';

interface ResumeData {
  basics: {
    name: string;
    email: string;
    phone: string;
    url: string;
    profiles?: { network: string; username: string; url: string }[];
    location?: {
      address: string;
      postalCode: string;
      city: string;
      countryCode: string;
      region: string;
    };
  };
  summary: string;
  skills: { name: string }[];
  work: { position: string; company: string; startDate: string; endDate: string; summary: string }[];
  education: { institution: string; area: string; studyType: string; startDate: string; endDate: string }[];
}

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

    const userInfoResult = await client.query(
      'SELECT fname, lname, contact_email AS email, phone_number AS phone, l.city, l.state FROM users.user_info ui LEFT JOIN public.locations l ON ui.location_id = l.id WHERE ui.user_id = $1',
      [user_id]
    );
    if (!userInfoResult.rows.length) throw new Error('User info not found');
    const userInfo = userInfoResult.rows[0];

    // Fetch profiles from users.profiles
    const profilesResult = await client.query(
      'SELECT network, username, url FROM users.profiles WHERE user_id = $1',
      [user_id]
    );
    const profiles = profilesResult.rows;

    const summaryResult = await client.query(
      'SELECT summary FROM users.summary WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [user_id]
    );
    const summary = summaryResult.rows[0]?.summary || '';

    const skillsResult = await client.query(
      `SELECT s.text AS skill_name FROM users.skills s JOIN users.skills_link sl ON s.id = sl.skill_id WHERE sl.user_id = $1`,
      [user_id]
    );
    const skills = skillsResult.rows.map(row => row.skill_name);

    const experienceResult = await client.query(
      `SELECT e.title AS position, c.name AS company, e.description AS summary, e.start_date AS "startDate", e.end_date AS "endDate"
       FROM users.experience e LEFT JOIN public.companies c ON e.company_id = c.id WHERE e.user_id = $1`,
      [user_id]
    );
    const experience = experienceResult.rows.map(row => ({
      position: row.position || 'Unknown Position',
      company: row.company || 'Unknown Company',
      summary: row.summary || '',
      startDate: row.startDate ? row.startDate.toISOString().split('T')[0] : 'N/A',
      endDate: row.endDate ? row.endDate.toISOString().split('T')[0] : 'Present',
    }));

    const educationResult = await client.query(
      `SELECT s.name AS institution, e.degree AS studyType, e.start_date AS "startDate", e.end_date AS "endDate"
       FROM users.education e JOIN public.schools s ON e.school_id = s.id WHERE e.user_id = $1`,
      [user_id]
    );
    const education = educationResult.rows.map(row => ({
      institution: row.institution || 'Unknown Institution',
      area: '',
      studyType: row.studyType || 'N/A',
      startDate: row.startDate ? row.startDate.toISOString().split('T')[0] : 'N/A',
      endDate: row.endDate ? row.endDate.toISOString().split('T')[0] : 'N/A',
    }));

    const jobResult = await client.query('SELECT description FROM jobs.jobs WHERE id = $1', [job_id]);
    if (!jobResult.rows.length) throw new Error('Job not found');
    const jobDescription = jobResult.rows[0].description;

    client.release();

    const tailoredData = await tailorResume(summary, skills, jobDescription);
    console.log('Tailored data:', tailoredData);

    const resumeData: ResumeData = {
      basics: {
        name: `${userInfo.fname || ''} ${userInfo.lname || ''}`.trim() || 'Applicant',
        email: userInfo.email || 'N/A',
        phone: userInfo.phone || 'N/A',
        url: profiles.length > 0 ? profiles[0].url : 'N/A',
        profiles: profiles.length > 0 ? profiles : undefined,
        location: {
          address: `${userInfo.city || 'Unknown City'}, ${userInfo.state || 'N/A'}`.trim(),
          postalCode: '',
          city: userInfo.city || 'Unknown City',
          countryCode: 'US',
          region: userInfo.state || 'N/A',
        },
      },
      summary: tailoredData.summary || '',
      skills: tailoredData.skills || [],
      work: experience.length > 0 ? experience : [{ position: 'N/A', company: 'N/A', startDate: 'N/A', endDate: 'N/A', summary: '' }],
      education: education.length > 0 ? education : [{ institution: 'N/A', area: '', studyType: 'N/A', startDate: 'N/A', endDate: 'N/A' }],
    };
    console.log('Resume data for rendering:', JSON.stringify(resumeData, null, 2));

    let html;
    try {
      html = elegantTheme.render(resumeData);
      console.log('Generated HTML:', html.slice(0, 500) + '...');
    } catch (renderErr) {
      console.error('Rendering error details:', renderErr);
      throw new Error('Failed to render resume HTML: ' + (renderErr instanceof Error ? renderErr.message : 'Unknown error'));
    }

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