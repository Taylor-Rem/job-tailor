import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import puppeteer from 'puppeteer';
import actualTheme from 'jsonresume-theme-actual';
import { tailorResume } from './tailorResume';

interface ResumeData {
  basics: {
    name: string;
    label?: string;
    image?: string;
    email: string;
    phone: string;
    url?: string;
    summary?: string;
    location: {
      address?: string;
      postalCode?: string;
      city?: string;
      countryCode?: string;
      region?: string;
    };
    profiles?: { network: string; username: string; url: string }[];
  };
  work: { name: string; position: string; url?: string; startDate: string; endDate: string; summary: string; highlights?: string[] }[];
  education: { institution: string; area?: string; studyType: string; startDate: string; endDate: string; score?: string; courses?: string[] }[];
  skills: { name: string; level?: string; keywords?: string[] }[];
  projects: { name: string; startDate?: string; endDate?: string; description: string; highlights?: string[]; url?: string }[];
  volunteer?: { organization: string; position: string; url?: string; startDate: string; endDate: string; summary: string; highlights?: string[] }[];
  awards?: { title: string; date: string; awarder: string; summary: string }[];
  certificates?: { name: string; date: string; issuer: string; url?: string }[];
  publications?: { name: string; publisher: string; releaseDate: string; url?: string; summary: string }[];
  languages?: { language: string; fluency: string }[];
  interests?: { name: string; keywords: string[] }[];
  references?: { name: string; reference: string }[];
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

    // Fetch user info
    const userInfoResult = await client.query(
      'SELECT fname, lname, contact_email AS email, phone_number AS phone, l.city, l.state FROM users.user_info ui LEFT JOIN public.locations l ON ui.location_id = l.id WHERE ui.user_id = $1',
      [user_id]
    );
    if (!userInfoResult.rows.length) throw new Error('User info not found');
    const userInfo = userInfoResult.rows[0];

    // Fetch profiles
    const profilesResult = await client.query(
      'SELECT network, username, url FROM users.profiles WHERE user_id = $1',
      [user_id]
    );
    const profiles = profilesResult.rows;

    // Fetch summary
    const summaryResult = await client.query(
      'SELECT summary FROM users.summary WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [user_id]
    );
    const summary = summaryResult.rows[0]?.summary || '';

    // Fetch skills
    const skillsResult = await client.query(
      'SELECT s.text AS name FROM users.skills s JOIN users.skills_link sl ON s.id = sl.skill_id WHERE sl.user_id = $1',
      [user_id]
    );
    const skills = skillsResult.rows.map(row => ({ name: row.name }));

    // Fetch work experience
    const experienceResult = await client.query(
      `SELECT e.title AS position, c.name AS company, e.description AS summary, e.start_date AS "startDate", e.end_date AS "endDate"
        FROM users.experience e LEFT JOIN public.companies c ON e.company_id = c.id WHERE e.user_id = $1`,
      [user_id]
    );
    const work = experienceResult.rows.map(row => ({
      name: row.company || 'Unknown Company',
      position: row.position || 'Unknown Position',
      summary: row.summary || '',
      startDate: row.startDate ? row.startDate.toISOString().split('T')[0] : 'N/A',
      endDate: row.endDate ? row.endDate.toISOString().split('T')[0] : null, // Use null instead of 'Present'
    }));

    // Fetch education
    const educationResult = await client.query(
      `SELECT s.name AS institution, e.url, e.area, e.study_type AS "studyType", e.start_date AS "startDate", e.end_date AS "endDate"
       FROM users.education e JOIN public.schools s ON e.school_id = s.id WHERE e.user_id = $1`,
      [user_id]
    );
    const education = educationResult.rows.map(row => ({
      institution: row.institution || 'Unknown Institution',
      url: row.url || undefined,
      area: row.area || undefined,
      studyType: row.studyType || 'N/A',
      startDate: row.startDate ? row.startDate.toISOString().split('T')[0] : undefined,
      endDate: row.endDate ? row.endDate.toISOString().split('T')[0] : null,
    }));

    // In generate.ts, update the projects query
    const projectsResult = await client.query(
      `SELECT title AS name, description, date_completed, links, roles
      FROM users.projects WHERE user_id = $1`,
      [user_id]
    );
    const projects = projectsResult.rows.map(row => ({
      name: row.name || 'Unnamed Project',
      description: row.description || '',
      endDate: row.date_completed ? row.date_completed.toISOString().split('T')[0] : undefined,
      url: row.links && row.links.url ? row.links.url : undefined,
      roles: row.roles || ['Contributor'], // Ensure roles is always an array
    }));

    // Fetch job description for tailoring
    const jobResult = await client.query('SELECT description FROM jobs.jobs WHERE id = $1', [job_id]);
    if (!jobResult.rows.length) throw new Error('Job not found');
    const jobDescription = jobResult.rows[0].description;

    client.release();

    // Tailor summary and skills
    const tailoredData = await tailorResume(summary, skills.map(s => s.name), jobDescription);

    const resumeData: ResumeData = {
      basics: {
        name: `${userInfo.fname || ''} ${userInfo.lname || ''}`.trim() || 'Applicant',
        email: userInfo.email || 'N/A',
        phone: userInfo.phone || 'N/A',
        url: profiles.length > 0 ? profiles[0].url : undefined,
        location: {
          city: userInfo.city || 'Unknown City',
          region: userInfo.state || 'N/A',
          countryCode: 'US',
        },
        profiles: profiles.length > 0 ? profiles : undefined,
      },
      work: work.length > 0 ? work : [],
      education: education.length > 0 ? education : [],
      skills: tailoredData.skills || skills,
      projects: projects.length > 0 ? projects : [],
      // Add placeholders for optional sections if you extend your DB later
      volunteer: [],
      awards: [],
      certificates: [],
      publications: [],
      languages: [],
      interests: [],
      references: [],
    };
    resumeData.basics.summary = tailoredData.summary || summary;
    // console.log(resumeData)

    const html = actualTheme.render(resumeData);
    console.log('Generated HTML:', html.slice(0, 500) + '...'); // Log first 500 chars for brevity

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html);
    const pdfBuffer = await page.pdf({ format: 'Letter', printBackground: true });
    await browser.close();

    // Write to file for debugging
    const fs = require('fs').promises;
    await fs.writeFile('debug_resume.pdf', pdfBuffer);
    console.log('PDF buffer length:', pdfBuffer.length); // Log buffer size

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${user_id}_${job_id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    console.error('Handler error:', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
}