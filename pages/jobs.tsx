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
    fetchFilterOptions(); // Fetch options on mount
    fetchJobs(); // Fetch jobs on mount and when filters change
  }, [jobTypeFilter, zipFilter, radiusFilter, locationFilter, tagFilter]);

  const formatSalary = (min: number, max: number, interval: string) => {
    if (min === 0 && max === 0) return 'N/A';
    return `${toMoney(min)}-${toMoney(max)} ${interval || ''}`.trim();
  };

  const toMoney = (num: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
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
        <div className="card">
          <h1 className="title">Job Listings</h1>
          {loading ? (
            <p className="message">Loading jobs...</p>
          ) : error ? (
            <p className="message">{error}</p>
          ) : jobs.length === 0 ? (
            <p className="message">No jobs found.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Remote</th>
                  <th>Salary</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.title}</td>
                    <td>{job.company}</td>
                    <td>{job.location_name || job.city_name}</td>
                    <td>{job.job_types.join(', ')}</td>
                    <td>{job.remote ? 'Yes' : 'No'}</td>
                    <td>{formatSalary(job.min_salary, job.max_salary, job.interval_code)}</td>
                    <td>
                      <a href={userId ? '/create_resume' : 'signup'} className="link">
                        Create Resume
                      </a>
                      <a href={job.url} target="_blank" rel="noopener noreferrer" className="link">
                        Apply
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}