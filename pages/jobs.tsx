import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Select from 'react-select';

interface Location {
  city: string;
  state: string | null;
  country: string;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface Job {
  id: number;
  title: string;
  company: string; // This will come from jobs.companies via JOIN
  description: string;
  url: string;
  locations: Location[];
  min_amount: number; // Changed from min_salary
  max_amount: number; // Changed from max_salary
  currency: string;   // Changed from interval_code
  tags: string[];
  remote: boolean;
}

export default function Jobs() {
  const { userId } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [zipFilter, setZipFilter] = useState('');
  const [radiusFilter, setRadiusFilter] = useState('50');
  const [locationFilter, setLocationFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [locationOptions, setLocationOptions] = useState<{ value: string; label: string }[]>([]);
  const [tagOptions, setTagOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [collapsedLocations, setCollapsedLocations] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchFilterOptions = async () => {
    try {
      const [locationsRes, tagsRes] = await Promise.all([
        fetch('/api/jobs/locations'),
        fetch('/api/jobs/tags'),
      ]);
      const locations = await locationsRes.json();
      const tags = await tagsRes.json();
      setLocationOptions(locations.map((loc: string) => ({ value: loc, label: loc })));
      setTagOptions(tags.map((tag: string) => ({ value: tag, label: tag })));
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    }
  };

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        ...(jobTypeFilter && { job_type: jobTypeFilter }),
        ...(zipFilter && { zip: zipFilter }),
        ...(zipFilter && { radius: radiusFilter }),
        ...(locationFilter && { location: locationFilter }),
        ...(tagFilter && { tag: tagFilter }),
        page: page.toString(),
      }).toString();
      const response = await fetch(`/api/jobs/list?${query}`);
      const data = await response.json();
      if (response.ok) {
        setJobs(data.jobs);
        setTotalPages(data.totalPages);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  }, [jobTypeFilter, zipFilter, radiusFilter, locationFilter, tagFilter, page]);

  useEffect(() => {
    fetchFilterOptions();
    fetchJobs();
  }, [jobTypeFilter, zipFilter, radiusFilter, locationFilter, tagFilter, page, fetchJobs]);

  const formatSalary = (min: number, max: number, currency: string) => {
    if (min === 0 && max === 0) return 'N/A';
    return `${toMoney(min)}-${toMoney(max)} ${currency}`;
  };

  const toMoney = (num: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setCollapsedLocations(true);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const toggleLocations = () => {
    setCollapsedLocations(!collapsedLocations);
  };

  const formatDescription = (text: string) => {
    const segments = text.split(/(\n|\.\s+)/).filter(segment => segment.trim());
    const elements = [];
    let listItems: string[] = [];

    segments.forEach((segment) => {
      const trimmed = segment.trim();
      if (
        trimmed.startsWith('- ') ||
        trimmed.startsWith('* ') ||
        /^\d+\.\s/.test(trimmed) ||
        trimmed.toLowerCase().includes('include')
      ) {
        const items = trimmed
          .split(/[-*]\s+|\d+\.\s+/)
          .filter(item => item.trim())
          .map(item => item.replace(/^include[s]?/i, '').trim());
        listItems.push(...items);
      } else {
        if (listItems.length > 0) {
          elements.push(
            <ul key={`list-${elements.length}`}>
              {listItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          );
          listItems = [];
        }
        if (trimmed && !/^\.\s+$/.test(trimmed)) {
          elements.push(<p key={`p-${elements.length}`}>{trimmed}</p>);
        }
      }
    });

    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`}>
          {listItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    }

    return elements.length > 0 ? elements : <p>{text}</p>;
  };

  const generateResume = async () => {
    if (!userId || !selectedJob) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/resumes/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          job_id: selectedJob.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate resume');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tailored_resume_${selectedJob.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating resume:', err);
      alert(err instanceof Error ? err.message : 'An error occurred while generating your resume');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="full-height">
      <div style={{ padding: '20px' }}>
        <div style={{ marginTop: '2em', marginBottom: '1em' }} className="card">
          <h1 className="title">Filters</h1>
          <div id="job-filters">
            <div className="filter-items">
              <label htmlFor="jobType">Job Type: </label>
              <Select
                id="jobType"
                options={tagOptions}
                value={tagOptions.find((opt) => opt.value === jobTypeFilter) || null}
                onChange={(option) => setJobTypeFilter(option ? option.value : '')}
                placeholder="Select a job type"
                isClearable
                className="react-select"
                classNamePrefix="select"
              />
            </div>
            <div className="filter-items">
              <label htmlFor="zip">Zip Code: </label>
              <input
                id="zip"
                type="text"
                value={zipFilter}
                onChange={(e) => setZipFilter(e.target.value)}
                placeholder="e.g., 94105"
                className="input"
                style={{ width: '100px' }}
              />
            </div>
            <div className="filter-items">
              <label htmlFor="radius">Radius (miles): </label>
              <select
                id="radius"
                value={radiusFilter}
                onChange={(e) => setRadiusFilter(e.target.value)}
                className="select"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <div className="filter-items">
              <label htmlFor="location">Location: </label>
              <Select
                id="location"
                options={locationOptions}
                value={locationOptions.find((opt) => opt.value === locationFilter) || null}
                onChange={(option) => setLocationFilter(option ? option.value : '')}
                placeholder="Select a location"
                isClearable
                className="react-select"
                classNamePrefix="select"
              />
            </div>
            <div className="filter-items">
              <label htmlFor="tag">Tag: </label>
              <Select
                id="tag"
                options={tagOptions}
                value={tagOptions.find((opt) => opt.value === tagFilter) || null}
                onChange={(option) => setTagFilter(option ? option.value : '')}
                placeholder="Select a tag"
                isClearable
                className="react-select"
                classNamePrefix="select"
              />
            </div>
          </div>
        </div>
        <div className="jobs-container">
          <div className="job-list-container">
            <h1 className="title">Job Listings</h1>
            {loading ? (
              <p className="message">Loading jobs...</p>
            ) : error ? (
              <p className="message">{error}</p>
            ) : jobs.length === 0 ? (
              <p className="message">No jobs found.</p>
            ) : (
              <>
                <div className="job-list">
                  <div className="job-item job-header">
                    <span>Title</span>
                    <span>Company</span>
                    <span>Locations</span>
                  </div>
                  {jobs.map((job) => {
                    const selectedLocationMatch = job.locations.find(
                      loc => `${loc.city} ${loc.state}` === locationFilter || loc.city === locationFilter || loc.state === locationFilter
                    );
                    const displayLocation = selectedLocationMatch
                      ? (selectedLocationMatch.city || selectedLocationMatch.state)
                      : (`${job.locations[0]?.city || ''}, ${job.locations[0]?.state || ''}` || 'N/A');
                    const hasMultiple = job.locations.length > 1;

                    return (
                      <div
                        key={job.id}
                        className={`job-item ${selectedJob?.id === job.id ? 'selected' : ''}`}
                        onClick={() => handleJobClick(job)}
                      >
                        <span className="job-title">{job.title}</span>
                        <span className="job-company">{job.company}</span>
                        <span className="job-locations">
                          {displayLocation}{hasMultiple ? '...' : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="pagination">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className="button"
                  >
                    Previous
                  </button>
                  <span>Page {page} of {totalPages}</span>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    className="button"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
          {selectedJob && (
            <div className="job-details-container">
              <div className="job-details-content">
                <h2>{selectedJob.title}</h2>
                <p><strong>Company:</strong> {selectedJob.company}</p>
                <p>
                  <strong>Locations:</strong>{' '}
                  <button onClick={toggleLocations} className="button" style={{ padding: '2px 8px', fontSize: '12px' }}>
                    {collapsedLocations ? 'Show' : 'Hide'} ({selectedJob.locations.length})
                  </button>
                  {!collapsedLocations && (
                    <span> {selectedJob.locations.map(loc => `${loc.city}, ${loc.state}`).join(' | ')}</span>
                  )}
                </p>
                <p><strong>Tags:</strong> {selectedJob.tags.join(', ')}</p>
                <p><strong>Remote:</strong> {selectedJob.remote ? 'Yes' : 'No'}</p>
                <p><strong>Salary:</strong> {formatSalary(selectedJob.min_amount, selectedJob.max_amount, selectedJob.currency)}</p>
                <div className="job-description">
                  <strong>Description:</strong>
                  {formatDescription(selectedJob.description)}
                </div>
                <div className="job-details-actions">
                  {userId ? (
                    <button
                      onClick={generateResume}
                      disabled={isGenerating}
                      className="button"
                    >
                      {isGenerating ? 'Generating...' : 'Generate Resume'}
                    </button>
                  ) : (
                    <a href="/signup" className="button">
                      Sign Up to Generate Resume
                    </a>
                  )}
                  <a href={selectedJob.url} target="_blank" rel="noopener noreferrer" className="button">
                    View Job on Site
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}