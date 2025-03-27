import type { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import pdfParse from 'pdf-parse';
import { deleteUserInfo } from './delete_user_info';

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

// Helper function to check if a string is a valid URL
function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user_id, file_name, resume } = req.body;
  console.log('Received:', { user_id, file_name, resume: resume.slice(0, 50) + '...' });
  if (!user_id || !file_name || !resume) return res.status(400).json({ error: 'Missing required fields' });

  const pdfBuffer = Buffer.from(resume, 'base64');
  const s3Key = `${user_id}/${Date.now()}/${file_name}`;

  try {
    if (!process.env.S3_BUCKET) throw new Error('S3_BUCKET environment variable is not set');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch user's email from users.users as a fallback
      const userResult = await client.query('SELECT email FROM users.users WHERE user_id = $1', [user_id]);
      const userEmail = userResult.rows[0]?.email || '';
      console.log('User email from users.users:', userEmail);

      // Delete existing resume from S3 and DB
      const resumeResult = await client.query('SELECT s3key FROM users.resume WHERE user_id = $1', [user_id]);
      const oldS3Key = resumeResult.rows[0]?.s3key;
      if (oldS3Key) {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: oldS3Key,
        }));
        console.log('Deleted old resume from S3:', { key: oldS3Key });
      }
      await client.query('DELETE FROM users.resume WHERE user_id = $1', [user_id]);

      // Wipe existing user data
      await deleteUserInfo(user_id, client);

      // Upload new resume to S3
      await s3Client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: s3Key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      }));
      console.log('Uploaded to S3:', { bucket: process.env.S3_BUCKET, key: s3Key });

      // Parse PDF
      const pdfData = await pdfParse(pdfBuffer);
      const resumeText = pdfData.text;

      // Parse with OpenAI
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
              content: 'Parse this resume text into a JSON object with: "header" (fname, lname, email, phone, address, links as array), "summary" (string), "skills" (array of strings), "experience" (array of {position, company, startDate, endDate, summary}), "education" (array of {institution, area, studyType, startDate, endDate}), "projects" (array of {title, description, dateCompleted, links as array}). Convert all dates (startDate, endDate, dateCompleted) to \'YYYY-MM-DD\' format for SQL compatibility. Use null (unquoted) for missing or present (ongoing) dates. Extract accurately, use "" or [] for missing fields. For "links" fields, only include valid URLs starting with "http://" or "https://". Return only the JSON.',
            },
            {
              role: 'user',
              content: `Resume text: "${resumeText}"`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) throw new Error('OpenAI API failed: ' + await response.text());
      const data = await response.json();
      const parsedResume = JSON.parse(data.choices[0].message.content);
      console.log('Parsed resume:', parsedResume);

      // Insert into users.resume
      const resumeInsert = await client.query(
        `INSERT INTO users.resume (user_id, s3key, file_name, resume_text)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [user_id, s3Key, file_name, resumeText]
      );
      const resumeId = resumeInsert.rows[0].id;

      // Insert into users.user_info
      const [city, state] = parsedResume.header.address 
        ? parsedResume.header.address.split(', ').map((part: string) => part.trim()) 
        : ['', ''];
      let locationId = null;
      if (city) {
        const locationResult = await client.query(`
          INSERT INTO public.locations (city, state, country, created_at, updated_at)
          VALUES ($1, $2, 'US', NOW(), NOW())
          ON CONFLICT (city, country) DO UPDATE SET
            state = EXCLUDED.state,
            updated_at = NOW()
          RETURNING id
        `, [city, state]);
        locationId = locationResult.rows[0].id;
      }

      const resumeEmail = parsedResume.header.email || '';
      const emailToUse = resumeEmail || userEmail;
      console.log('Email to use:', emailToUse);

      await client.query(`
        INSERT INTO users.user_info (user_id, fname, lname, contact_email, phone_number, location_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO UPDATE SET
          fname = EXCLUDED.fname,
          lname = EXCLUDED.lname,
          contact_email = EXCLUDED.contact_email,
          phone_number = EXCLUDED.phone_number,
          location_id = EXCLUDED.location_id,
          updated_at = NOW()
      `, [
        user_id,
        parsedResume.header.fname || '',
        parsedResume.header.lname || '',
        emailToUse,
        parsedResume.header.phone || '',
        locationId
      ]);

      // Insert into users.profiles
      if (parsedResume.header.links && parsedResume.header.links.length > 0) {
        for (const link of parsedResume.header.links) {
          if (!isValidUrl(link)) {
            console.warn(`Skipping invalid profile link: ${link}`);
            continue;
          }
          const url = link;
          const network = new URL(url).hostname;
          const username = url.split('/').filter(Boolean).pop() || 'N/A';
          await client.query(`
            INSERT INTO users.profiles (user_id, network, username, url)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, network) DO UPDATE SET
              username = EXCLUDED.username,
              url = EXCLUDED.url,
              updated_at = NOW()
          `, [user_id, network, username, url]);
        }
      }

      // Insert into users.summary
      if (parsedResume.summary) {
        await client.query(`
          INSERT INTO users.summary (user_id, summary)
          VALUES ($1, $2)
        `, [user_id, parsedResume.summary]);
      }

      // Insert into users.projects
      for (const project of parsedResume.projects) {
        const validLinks = (project.links || []).filter(link => isValidUrl(link));
        if (project.links && project.links.length > validLinks.length) {
          console.warn(`Invalid project links skipped for project "${project.title}": ${project.links.filter(link => !isValidUrl(link)).join(', ')}`);
        }
        await client.query(`
          INSERT INTO users.projects (user_id, title, description, date_completed, links)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          user_id,
          project.title || '',
          project.description || '',
          project.dateCompleted,
          JSON.stringify(validLinks.length ? validLinks.reduce((acc: any, link: string) => ({ ...acc, [new URL(link).hostname]: link }), {}) : {})
        ]);
      }

      // Insert into users.experience
      for (const exp of parsedResume.experience) {
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
        `, [
          user_id,
          companyId,
          exp.position || '',
          exp.summary || '',
          exp.startDate,
          exp.endDate === '' ? null : exp.endDate
        ]);
      }

      // Insert into public.schools and users.education
      for (const edu of parsedResume.education) {
        let schoolId = null;
        if (edu.institution) {
          const schoolResult = await client.query(`
            INSERT INTO public.schools (name, created_at, updated_at)
            VALUES ($1, NOW(), NOW())
            ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
            RETURNING id
          `, [edu.institution]);
          schoolId = schoolResult.rows[0].id;
        }

        if (schoolId) {
          await client.query(`
            INSERT INTO users.education (user_id, school_id, start_date, end_date, degree)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            user_id,
            schoolId,
            edu.startDate,
            edu.endDate === '' ? null : edu.endDate,
            `${edu.studyType || ''} ${edu.area || ''}`.trim() || null
          ]);
        }
      }

      // Insert into users.skills and users.skills_link
      if (parsedResume.skills.length > 0) {
        for (const skill of parsedResume.skills) {
          const skillInsert = await client.query(`
            INSERT INTO users.skills (text, created_at)
            VALUES ($1, NOW())
            ON CONFLICT (text) DO UPDATE SET created_at = EXCLUDED.created_at
            RETURNING id
          `, [skill]);
          const skillId = skillInsert.rows[0].id;

          await client.query(`
            INSERT INTO users.skills_link (user_id, skill_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [user_id, skillId]);
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