// pages/api/upload-resume.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createTemporaryUser } from '../../lib/user';
import { deleteUserResumeData, parseResume, saveResume } from '../../lib/resume';
import { uploadToS3 } from '../../lib/s3';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user_id: providedUserId, file_name, resume } = req.body;
  if (!file_name || !resume) return res.status(400).json({ error: 'Missing required fields' });

  const pdfBuffer = Buffer.from(resume, 'base64');
  let user_id = providedUserId;

  try {
    if (!user_id) {
      const tempUserResult = await createTemporaryUser();
      if (!tempUserResult.success) throw new Error(tempUserResult.error);
      user_id = tempUserResult.user.id;
    }

    await deleteUserResumeData(user_id);
    const { resumeText, parsedResume } = await parseResume(pdfBuffer);
    const s3Key = await uploadToS3(user_id, file_name, pdfBuffer);
    const resumeId = await saveResume({
      user_id,
      s3Key,
      file_name,
      resumeText, // Use parsed text instead of raw buffer
      parsedResume,
    });

    res.status(200).json({
      message: 'Resume uploaded and processed',
      resume_id: resumeId,
      temp_user_id: providedUserId ? null : user_id,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: (err as Error).message || 'Failed to process resume' });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };