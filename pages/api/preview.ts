import type { NextApiRequest, NextApiResponse } from 'next';
import actualTheme from 'jsonresume-theme-actual';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { resumeData } = req.body;
  if (!resumeData) return res.status(400).json({ error: 'resumeData required' });

  try {
    const formattedData = {
      basics: {
        name: `${resumeData.fname || ''} ${resumeData.lname || ''}`.trim() || 'Unnamed',
        email: resumeData.email || '',
        phone: resumeData.phone || '',
        location: { city: resumeData.city || '', region: resumeData.state || '', countryCode: 'US' },
        summary: resumeData.summary || '',
      },
      skills: resumeData.skills.map((skill: string) => ({ name: skill })),
      work: resumeData.experience.map((exp: any) => ({
        name: exp.company || '',
        position: exp.title || '',
        summary: exp.description || '',
        startDate: exp.start_date || '',
        endDate: exp.end_date || null,
      })),
      education: resumeData.education.map((edu: any) => ({
        institution: edu.school || '',
        url: edu.url || '',
        area: edu.area || '',
        studyType: edu.study_type || '',
        startDate: edu.start_date || '',
        endDate: edu.end_date || null,
      })),
      projects: resumeData.projects.map((proj: any) => ({
        name: proj.title || '',
        description: proj.description || '',
        endDate: proj.date_completed || null,
        url: proj.links ? Object.values(proj.links)[0] : undefined,
        roles: proj.roles || [],
      })),
    };

    const html = actualTheme.render(formattedData);
    res.status(200).json({ html });
  } catch (err) {
    console.error('Preview rendering failed:', err);
    res.status(500).json({ error: 'Failed to render preview' });
  }
}