import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Select from 'react-select';

interface Job {
  id: number;
  title: string;
  company: string;
  description: string;
  url: string;
  zip_code: string;
  city_name: string;
  latitude: number;
  longitude: number;
  country_code: string;
  location_name: string;
  country_subdivision_code: string | null;
  min_salary: number;
  max_salary: number;
  interval_code: string;
  tags: string[];
  remote: boolean;
  job_types: string[];
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

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        ...(jobTypeFilter && { job_type: jobTypeFilter }),
        ...(zipFilter && { zip: zipFilter }),
        ...(zipFilter && { radius: radiusFilter }),
        ...(locationFilter && { location: locationFilter }),
        ...(tagFilter && { tag: tagFilter }),
      }).toString();
      const response = await fetch(`/api/jobs/list?${query}`);
      const data = await response.json();
      if (response.ok) {
        setJobs(data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    fetchFilterOptions();
    fetchJobs();
  }, [jobTypeFilter, zipFilter, radiusFilter, locationFilter, tagFilter]);

  const formatSalary = (min: number, max: number, interval: string) => {
    if (min === 0 && max === 0) return 'N/A';
    const intervalText = interval === 'PH' ? 'per hour' : interval === 'PA' ? 'per year' : interval;
    return `${toMoney(min)}-${toMoney(max)} ${intervalText}`.trim();
  };

  const toMoney = (num: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
  };

  return (
    <div className="full-height">
      <div style={{ padding: '20px' }}>
        <div style={{ marginTop: '2em', marginBottom: '1em' }} className="card">
          <h1 className="title">Filters</h1>
          <div id="job-filters">
            <div className="filter-items">
              <label htmlFor="jobType">Job Type: </label>
              <select
                id="jobType"
                value={jobTypeFilter}
                onChange={(e) => setJobTypeFilter(e.target.value)}
                className="select"
              >
                <option value="">All</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
              </select>
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
              <label htmlFor="tag">Position Type: </label>
              <Select
                id="tag"
                options={tagOptions}
                value={tagOptions.find((opt) => opt.value === tagFilter) || null}
                onChange={(option) => setTagFilter(option ? option.value : '')}
                placeholder="Select a position type"
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
              <div className="job-list">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className={`job-item ${selectedJob?.id === job.id ? 'selected' : ''}`}
                    onClick={() => handleJobClick(job)}
                  >
                    <span>{job.title}</span>
                    <span>{job.company}</span>
                    <span>{job.location_name || job.city_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedJob && (
            <div className="job-details-container">
              <div className="job-details-content">
                <h2>{selectedJob.title}</h2>
                <p><strong>Company:</strong> {selectedJob.company}</p>
                <p><strong>Location:</strong> {selectedJob.location_name || selectedJob.city_name}</p>
                <p><strong>Type:</strong> {selectedJob.job_types.join(', ')}</p>
                <p><strong>Remote:</strong> {selectedJob.remote ? 'Yes' : 'No'}</p>
                <p><strong>Salary:</strong> {formatSalary(selectedJob.min_salary, selectedJob.max_salary, selectedJob.interval_code)}</p>
                <p><strong>Description:</strong> {selectedJob.description}</p>
                <div className="job-details-actions">
                  <a href={userId ? '/create_resume' : 'signup'} className="button">
                    Create Resume
                  </a>
                  <a href={selectedJob.url} target="_blank" rel="noopener noreferrer" className="button">
                    Apply
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