import { prisma } from './db';
import { deleteFromS3 } from './s3';
import pdfParse from 'pdf-parse';

function toDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export async function extractResumeText(pdfBuffer: Buffer): Promise<string> {
  try {
    const pdfData = await pdfParse(pdfBuffer);
    return pdfData.text.replace(/\0/g, '');
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to extract resume text');
  }
}

export async function deleteUserResumeData(user_id: number) {
  // Find all resumes for the user
  const resumes = await prisma.resume.findMany({
    where: { user_id },
    select: { id: true, s3key: true }, // Only need ID and S3 key
  });

  // Delete from S3
  for (const resume of resumes) {
    if (resume.s3key) {
      try {
        await deleteFromS3(resume.s3key);
      } catch (error) {
        console.error(`Failed to delete S3 object ${resume.s3key}:`, error);
        // Continue even if S3 delete fails (orphaned objects can be cleaned later)
      }
    }
  }

  // Delete from DB (cascades to related tables)
  await prisma.resume.deleteMany({
    where: { user_id },
  });
}

export async function saveResume({
  user_id,
  s3Key,
  file_name,
  resumeText,
  parsedResume,
}: {
  user_id: number;
  s3Key: string;
  file_name: string;
  resumeText: string;
  parsedResume: any;
}) {
  const sanitizedResumeText = resumeText.replace(/\0/g, '');
  console.log('Saving resume with text length:', sanitizedResumeText.length);
  console.log('Parsed resume:', JSON.stringify(parsedResume, null, 2));

  return await prisma.$transaction(async (tx) => {
    const resume = await tx.resume.create({
      data: {
        user_id,
        s3key: s3Key,
        file_name,
        resume_text: sanitizedResumeText,
      },
    });
    const resumeId = resume.id;

    const [city, state] = parsedResume.header.address
      ? parsedResume.header.address.split(', ').map((part: string) => part.trim())
      : ['', ''];
    let locationId: number | null = null;
    if (city) {
      const location = await tx.locations.upsert({
        where: { city_country: { city, country: 'US' } },
        update: { state, updated_at: new Date() },
        create: { city, state, country: 'US', created_at: new Date(), updated_at: new Date() },
      });
      locationId = location.id;
    }
    await tx.user_info.upsert({
      where: { resume_id: resumeId },
      update: {
        fname: parsedResume.header.fname || '',
        lname: parsedResume.header.lname || '',
        contact_email: parsedResume.header.email || '',
        phone_number: parsedResume.header.phone || '',
        location_id: locationId,
        updated_at: new Date(),
      },
      create: {
        resume_id: resumeId,
        fname: parsedResume.header.fname || '',
        lname: parsedResume.header.lname || '',
        contact_email: parsedResume.header.email || '',
        phone_number: parsedResume.header.phone || '',
        location_id: locationId,
      },
    });

    if (parsedResume.header.links?.length) {
      for (const link of parsedResume.header.links) {
        if (!isValidUrl(link)) continue;
        const url = link;
        const network = new URL(url).hostname;
        const username = url.split('/').filter(Boolean).pop() || 'N/A';
        await tx.profiles.upsert({
          where: { resume_id_network: { resume_id: resumeId, network } },
          update: { username, url, updated_at: new Date() },
          create: { resume_id: resumeId, network, username, url },
        });
      }
    }

    if (parsedResume.summary) {
      await tx.summary.create({
        data: { resume_id: resumeId, summary: parsedResume.summary },
      });
    }

    for (const project of parsedResume.projects || []) {
      const validLinks = (project.links || []).filter(isValidUrl);
      await tx.projects.create({
        data: {
          resume_id: resumeId,
          title: project.title || '',
          description: project.description || '',
          date_completed: toDate(project.dateCompleted),
          links: validLinks.length ? validLinks : [],
          roles: project.roles || ['Contributor'],
        },
      });
    }

    for (const exp of parsedResume.experience || []) {
      let companyId: number | null = null;
      if (exp.company) {
        const company = await tx.companies.upsert({
          where: { name: exp.company },
          update: { updated_at: new Date() },
          create: { name: exp.company, created_at: new Date(), updated_at: new Date() },
        });
        companyId = company.id;
      }
      await tx.experience.create({
        data: {
          resume_id: resumeId,
          company_id: companyId,
          title: exp.position || '',
          description: exp.summary || '',
          start_date: toDate(exp.startDate),
          end_date: toDate(exp.endDate),
        },
      });
    }

    for (const edu of parsedResume.education || []) {
      let schoolId: number | null = null;
      if (edu.institution) {
        const school = await tx.schools.upsert({
          where: { name: edu.institution },
          update: { updated_at: new Date() },
          create: { name: edu.institution, created_at: new Date(), updated_at: new Date() },
        });
        schoolId = school.id;
      }
      if (schoolId) {
        await tx.education.create({
          data: {
            resume_id: resumeId,
            school_id: schoolId,
            url: edu.url || null,
            area: edu.area || null,
            study_type: edu.studyType || null,
            start_date: toDate(edu.startDate),
            end_date: toDate(edu.endDate),
          },
        });
      }
    }

    for (const skill of parsedResume.skills || []) {
      const skillRecord = await tx.skills.upsert({
        where: { text: skill },
        update: {},
        create: { text: skill, created_at: new Date() },
      });
      await tx.skills_link.upsert({
        where: { resume_id_skill_id: { resume_id: resumeId, skill_id: skillRecord.id } },
        update: {},
        create: { resume_id: resumeId, skill_id: skillRecord.id },
      });
    }

    return resumeId;
  });
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}