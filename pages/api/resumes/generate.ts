import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import PDFDocument from 'pdfkit';

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

async function generateResume(resumeText: string, jobDescription: string) {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: 'You are an expert resume assistant. Return *only* a valid JSON object (no markdown, no extra text) with sections: "contact" (string), "summary" (string), "skills" (array of strings), "experience" (string), "education" (string). Optimize for ATS with job-relevant keywords.',
        },
        {
          role: 'user',
          content: `Given this resume text: "${resumeText}" and job description: "${jobDescription}", generate a tailored resume in JSON format.`,
        },
      ],
      model: 'grok-2-latest',
      stream: false,
      temperature: 0,
      max_tokens: 2400,
    }),
  });

  if (!response.ok) throw new Error(`xAI API error: ${response.statusText}`);
  const data = await response.json();
  const rawContent = data.choices[0].message.content;

  // Log raw response for debugging
  console.log('Raw xAI response:', rawContent);

  // Strip markdown or extra text if present
  let jsonContent = rawContent;
  const jsonMatch = rawContent.match(/\{[\s\S]*\}/); // Extract JSON object
  if (jsonMatch) {
    jsonContent = jsonMatch[0]; // Use the matched JSON
  }

  try {
    return JSON.parse(jsonContent);
  } catch (parseErr) {
    console.error('Failed to parse JSON:', parseErr, 'Raw content:', rawContent);
    throw new Error('Invalid JSON response from xAI');
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user_id, job_id } = req.body;
  if (!user_id || !job_id) {
    return res.status(400).json({ error: 'user_id and id required' });
  }

  try {
    const client = await pool.connect();
    const resumeResult = await client.query('SELECT resume_text FROM user_resumes WHERE user_id = $1', [user_id]);
    if (!resumeResult.rows.length) throw new Error('No resume found');
    const resumeText = resumeResult.rows[0].resume_text;

    const jobResult = await client.query('SELECT description FROM jobs WHERE id = $1', [job_id]);
    if (!jobResult.rows.length) throw new Error('Job not found');
    const jobDescription = jobResult.rows[0].description;
    client.release();

    const { contact, summary, skills, experience, education } = await generateResume(resumeText, jobDescription);

    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="tailored_resume_${job_id}.pdf"`);
      res.send(pdfBuffer);
    });

    doc.font('Helvetica').fontSize(11);
    doc.text('Contact Info', { underline: true }).moveDown(0.5);
    doc.text(contact || 'Not provided').moveDown(1);
    doc.text('Summary', { underline: true }).moveDown(0.5);
    doc.text(summary || '').moveDown(1);
    doc.text('Skills', { underline: true }).moveDown(0.5);
    doc.text(skills?.join(', ') || '').moveDown(1);
    doc.text('Experience', { underline: true }).moveDown(0.5);
    doc.text(experience || '').moveDown(1);
    doc.text('Education', { underline: true }).moveDown(0.5);
    doc.text(education || '');

    doc.end();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    res.status(500).json({ error: errorMessage });
  }
}