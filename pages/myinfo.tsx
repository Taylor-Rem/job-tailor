import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';

export default function MyInfo() {
  const { userId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<any>({
    fname: '',
    lname: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    summary: '',
    skills: [],
    experience: [],
    education: [],
    projects: [],
  });
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState({
    header: true,
    summary: false,
    skills: false,
    experience: false,
    education: false,
    projects: false,
  });

  useEffect(() => {
    if (!userId) {
      router.push('/login');
    } else {
      const fetchResumeData = async () => {
        try {
          const res = await fetch('/api/users/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId }),
          });
          const data = await res.json();
          if (res.ok) {
            const normalizedProjects = (data.projects || []).map((proj: any) => ({
              ...proj,
              roles: Array.isArray(proj.roles) ? proj.roles : proj.roles ? [proj.roles] : [],
              links: proj.links && typeof proj.links === 'object' ? proj.links : {},
            }));
            setResumeData({ ...data, projects: normalizedProjects });
          } else throw new Error(data.error);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load resume data');
        } finally {
          setLoading(false);
        }
      };
      fetchResumeData();
    }
  }, [userId, router]);

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const res = await fetch('/api/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeData }),
        });
        const { html } = await res.json();
        if (res.ok) setPreviewHtml(html);
        else throw new Error('Failed to fetch preview');
      } catch (err) {
        console.error('Preview fetch failed:', err);
        setPreviewHtml('<p>Error rendering preview</p>');
      }
    };

    if (!loading) {
      const timer = setTimeout(fetchPreview, 300);
      return () => clearTimeout(timer);
    }
  }, [resumeData, loading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, section: string, index?: number) => {
    const { name, value } = e.target;
    setResumeData((prev: any) => {
      if (index !== undefined) {
        const updatedSection = [...prev[section]];
        if (name === 'roles' || name === 'links') {
          updatedSection[index] = {
            ...updatedSection[index],
            [name]: name === 'roles' ? value.split(',').map(item => item.trim()) : value.split(',').reduce((acc, link) => {
              const trimmed = link.trim();
              return trimmed ? { ...acc, [new URL(trimmed).hostname]: trimmed } : acc;
            }, {}),
          };
        } else {
          updatedSection[index] = { ...updatedSection[index], [name]: value };
        }
        return { ...prev, [section]: updatedSection };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleAddItem = (section: string) => {
    setResumeData((prev: any) => ({
      ...prev,
      [section]: [...prev[section], section === 'skills' ? '' : section === 'projects' ? { roles: [], links: {} } : {}],
    }));
  };

  const handleRemoveItem = (section: string, index: number) => {
    setResumeData((prev: any) => ({
      ...prev,
      [section]: prev[section].filter((_: any, i: number) => i !== index),
    }));
  };

  const handleSave = async () => {
    try {
      const res = await fetch('/api/users/info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, ...resumeData }),
      });
      if (res.ok) {
        const updatedData = await res.json();
        setResumeData((prev: any) => ({ ...prev, ...updatedData }));
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, job_id: 'preview' }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${userId}_preview.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error('Failed to generate PDF');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download PDF');
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (!userId) return null;

  return (
    <div className="full-height" style={{ paddingTop: '80px', display: 'flex', gap: '20px' }}>
      {/* Edit Form */}
      <div className="card" style={{ flex: 1, maxWidth: '50%', overflowY: 'auto' }}>
        <h1 className="title">Edit My Info</h1>
        {loading ? (
          <p className="message">Loading...</p>
        ) : error ? (
          <p className="message">{error}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Header */}
            <div className="collapsible-section">
              <h2 className="collapsible-header" onClick={() => toggleSection('header')}>
                Header {expandedSections.header ? '▲' : '▼'}
              </h2>
              {expandedSections.header && (
                <div className="collapsible-content">
                  <input name="fname" value={resumeData.fname || ''} onChange={e => handleInputChange(e, 'header')} placeholder="First Name" className="input" />
                  <input name="lname" value={resumeData.lname || ''} onChange={e => handleInputChange(e, 'header')} placeholder="Last Name" className="input" />
                  <input name="email" value={resumeData.email || ''} onChange={e => handleInputChange(e, 'header')} placeholder="Email" className="input" />
                  <input name="phone" value={resumeData.phone || ''} onChange={e => handleInputChange(e, 'header')} placeholder="Phone" className="input" />
                  <input name="city" value={resumeData.city || ''} onChange={e => handleInputChange(e, 'header')} placeholder="City" className="input" />
                  <input name="state" value={resumeData.state || ''} onChange={e => handleInputChange(e, 'header')} placeholder="State" className="input" />
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="collapsible-section">
              <h2 className="collapsible-header" onClick={() => toggleSection('summary')}>
                Summary {expandedSections.summary ? '▲' : '▼'}
              </h2>
              {expandedSections.summary && (
                <div className="collapsible-content">
                  <textarea name="summary" value={resumeData.summary || ''} onChange={e => handleInputChange(e, 'summary')} placeholder="Summary" className="input" rows={4} />
                </div>
              )}
            </div>

            {/* Skills */}
            <div className="collapsible-section">
              <h2 className="collapsible-header" onClick={() => toggleSection('skills')}>
                Skills {expandedSections.skills ? '▲' : '▼'}
              </h2>
              {expandedSections.skills && (
                <div className="collapsible-content">
                  {resumeData.skills.map((skill: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <input value={skill || ''} onChange={e => handleInputChange(e, 'skills', i)} placeholder="Skill" className="input" />
                      <button onClick={() => handleRemoveItem('skills', i)} className="button">Remove</button>
                    </div>
                  ))}
                  <button onClick={() => handleAddItem('skills')} className="button">Add Skill</button>
                </div>
              )}
            </div>

            {/* Experience */}
            <div className="collapsible-section">
              <h2 className="collapsible-header" onClick={() => toggleSection('experience')}>
                Experience {expandedSections.experience ? '▲' : '▼'}
              </h2>
              {expandedSections.experience && (
                <div className="collapsible-content">
                  {resumeData.experience.map((exp: any, i: number) => (
                    <div key={i} style={{ marginBottom: '20px' }}>
                      <input name="title" value={exp.title || ''} onChange={e => handleInputChange(e, 'experience', i)} placeholder="Title" className="input" />
                      <input name="company" value={exp.company || ''} onChange={e => handleInputChange(e, 'experience', i)} placeholder="Company" className="input" />
                      <input name="start_date" value={exp.start_date || ''} onChange={e => handleInputChange(e, 'experience', i)} placeholder="Start Date (YYYY-MM-DD)" className="input" />
                      <input name="end_date" value={exp.end_date || ''} onChange={e => handleInputChange(e, 'experience', i)} placeholder="End Date (YYYY-MM-DD or blank)" className="input" />
                      <textarea name="description" value={exp.description || ''} onChange={e => handleInputChange(e, 'experience', i)} placeholder="Description" className="input" rows={3} />
                      <button onClick={() => handleRemoveItem('experience', i)} className="button">Remove</button>
                    </div>
                  ))}
                  <button onClick={() => handleAddItem('experience')} className="button">Add Experience</button>
                </div>
              )}
            </div>

            {/* Education */}
            <div className="collapsible-section">
              <h2 className="collapsible-header" onClick={() => toggleSection('education')}>
                Education {expandedSections.education ? '▲' : '▼'}
              </h2>
              {expandedSections.education && (
                <div className="collapsible-content">
                  {resumeData.education.map((edu: any, i: number) => (
                    <div key={i} style={{ marginBottom: '20px' }}>
                      <input name="school" value={edu.school || ''} onChange={e => handleInputChange(e, 'education', i)} placeholder="Institution" className="input" />
                      <input name="url" value={edu.url || ''} onChange={e => handleInputChange(e, 'education', i)} placeholder="URL" className="input" />
                      <input name="area" value={edu.area || ''} onChange={e => handleInputChange(e, 'education', i)} placeholder="Area" className="input" />
                      <input name="study_type" value={edu.study_type || ''} onChange={e => handleInputChange(e, 'education', i)} placeholder="Study Type" className="input" />
                      <input name="start_date" value={edu.start_date || ''} onChange={e => handleInputChange(e, 'education', i)} placeholder="Start Date (YYYY-MM-DD)" className="input" />
                      <input name="end_date" value={edu.end_date || ''} onChange={e => handleInputChange(e, 'education', i)} placeholder="End Date (YYYY-MM-DD or blank)" className="input" />
                      <button onClick={() => handleRemoveItem('education', i)} className="button">Remove</button>
                    </div>
                  ))}
                  <button onClick={() => handleAddItem('education')} className="button">Add Education</button>
                </div>
              )}
            </div>

            {/* Projects */}
            <div className="collapsible-section">
              <h2 className="collapsible-header" onClick={() => toggleSection('projects')}>
                Projects {expandedSections.projects ? '▲' : '▼'}
              </h2>
              {expandedSections.projects && (
                <div className="collapsible-content">
                  {resumeData.projects.map((proj: any, i: number) => (
                    <div key={i} style={{ marginBottom: '20px' }}>
                      <input name="title" value={proj.title || ''} onChange={e => handleInputChange(e, 'projects', i)} placeholder="Title" className="input" />
                      <textarea name="description" value={proj.description || ''} onChange={e => handleInputChange(e, 'projects', i)} placeholder="Description" className="input" rows={3} />
                      <input name="date_completed" value={proj.date_completed || ''} onChange={e => handleInputChange(e, 'projects', i)} placeholder="Date Completed (YYYY-MM-DD)" className="input" />
                      <input name="links" value={proj.links ? Object.values(proj.links).join(', ') : ''} onChange={e => handleInputChange(e, 'projects', i)} placeholder="Links (comma-separated)" className="input" />
                      <input name="roles" value={Array.isArray(proj.roles) ? proj.roles.join(', ') : proj.roles || ''} onChange={e => handleInputChange(e, 'projects', i)} placeholder="Roles (comma-separated)" className="input" />
                      <button onClick={() => handleRemoveItem('projects', i)} className="button">Remove</button>
                    </div>
                  ))}
                  <button onClick={() => handleAddItem('projects')} className="button">Add Project</button>
                </div>
              )}
            </div>

            <div>
              <button onClick={handleSave} className="button">Save</button>
              <button onClick={() => router.push('/account')} className="button" style={{ marginLeft: '10px' }}>Cancel</button>
              <button onClick={handleDownloadPDF} className="button" style={{ marginLeft: '10px' }}>Download PDF</button>
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
        <div style={{ maxWidth: '50%', overflowY: 'auto', padding: '20px', border: '1px solid #ccc' }}>
            <h2>Resume Preview</h2>
            <div style={{ transform: 'scale(0.7)', maxHeight: '100vh', transformOrigin: 'top left', width: '300mm' }}>
            <div
                dangerouslySetInnerHTML={{ __html: previewHtml }}
                style={{ background: '#fff', padding: '15mm', boxSizing: 'border-box' }}
            />
            </div>
        </div>
    </div>
  );
}