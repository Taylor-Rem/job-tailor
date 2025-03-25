import type { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import pdfParse from 'pdf-parse';

const s3Client = new S3Client({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID!,
    secretAccessKey: process.env.SECRET_ACCESS_KEY!,
  },
});

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user_id, file_name, resume } = req.body;
  console.log('Received:', { user_id, file_name, resume: resume.slice(0, 50) + '...' });
  if (!user_id || !file_name || !resume) return res.status(400).json({ error: 'Missing required fields' });

  const pdfBuffer = Buffer.from(resume, 'base64');
  const s3Key = `${user_id}/${Date.now()}/${file_name}`;

  try {
    if (!process.env.S3_BUCKET) throw new Error('S3_BUCKET environment variable is not set');

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    }));
    console.log('Uploaded to S3:', { bucket: process.env.S3_BUCKET, key: s3Key });

    const pdfData = await pdfParse(pdfBuffer);
    const resumeText = pdfData.text;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-2024-07-18',
        messages: [
          {
            role: 'system',
            content: 'Parse this resume text into a JSON object with: "header" (name, email, phone, address, links as array), "summary" (string), "skills" (array of strings), "experience" (array of {position, company, startDate, endDate, summary}), "education" (array of {institution, area, studyType, startDate, endDate}). Extract accurately, use "" or [] for missing fields. Return only the JSON.',
          },
          {
            role: 'user',
            content: `Resume text: "${resumeText}"`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) throw new Error('OpenAI API failed: ' + await response.text());
    const data = await response.json();
    const parsedResume = JSON.parse(data.choices[0].message.content);
    console.log('Parsed resume:', parsedResume);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const resumeInsert = await client.query(
        `INSERT INTO user_resumes (user_id, s3_key, file_name, resume_text, header, summary, experience, education)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING resume_id`,
        [
          user_id,
          s3Key,
          file_name,
          resumeText,
          JSON.stringify(parsedResume.header),
          parsedResume.summary,
          JSON.stringify(parsedResume.experience),
          JSON.stringify(parsedResume.education),
        ]
      );
      const resumeId = resumeInsert.rows[0].resume_id;

      if (parsedResume.skills.length > 0) {
        for (const skill of parsedResume.skills) {
          const skillInsert = await client.query(
            `INSERT INTO skills (skill_name, created_at)
             VALUES ($1, NOW())
             ON CONFLICT (skill_name) DO UPDATE SET created_at = EXCLUDED.created_at
             RETURNING skill_id`,
            [skill]
          );
          const skillId = skillInsert.rows[0].skill_id;

          await client.query(
            `INSERT INTO resume_skills (resume_id, skill_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [resumeId, skillId]
          );
        }
      }

      await client.query('COMMIT');
      res.status(200).json({ message: 'Upload and parsing successful', resume_id: resumeId });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: (err as Error).message || 'Failed to upload resume' });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };