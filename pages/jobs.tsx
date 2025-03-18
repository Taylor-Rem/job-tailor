// pages/jobs.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';

interface Location {
  CityName: string;
  Latitude: number;
  Longitude: number;
  CountryCode: string;
  LocationName: string;
  CountrySubDivisionCode?: string;
}

interface Job {
  id: number;
  title: string;
  company: string;
  description: string;
  url: string;
  locations: Location[];
  tags: string[];
  remote: boolean;
  job_types: string[];
  salary_range: string | { max: number; min: number; interval: string } | null;
}

export default function Jobs() {
  const { userId } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [zipFilter, setZipFilter] = useState('');
  const [radiusFilter, setRadiusFilter] = useState('50'); // Default 50 miles

  useEffect(() => {
    if (!userId) {
      router.push('/login');
    } else {
      fetchJobs();
    }
  }, [userId, router, jobTypeFilter, zipFilter, radiusFilter]);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        ...(jobTypeFilter && { job_type: jobTypeFilter }),
        ...(zipFilter && { zip: zipFilter }),
        ...(zipFilter && { radius: radiusFilter }),
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

  const formatSalary = (salary: Job['salary_range']) => {
    if (!salary) return 'N/A';
    if (typeof salary === 'string') return salary;
    if (typeof salary === 'object' && 'max' in salary && 'min' in salary) {
      return `${salary.min}-${salary.max} ${salary.interval || ''}`.trim();
    }
    return 'N/A';
  };

  const formatLocations = (locations: Location[]) => {
    return locations.map(loc => loc.LocationName || loc.CityName).join(', ');
  };

  if (!userId) return <div>Loading...</div>;

  return (
    <div className="full-height" style={{ paddingTop: '80px' }}>
      <div className="card">
        <h1 className="title">Job Listings</h1>

        {/* Filters */}
        <div style={{ marginBottom: '20px' }}>
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

          <label htmlFor="zip" style={{ marginLeft: '20px' }}>Zip Code: </label>
          <input
            id="zip"
            type="text"
            value={zipFilter}
            onChange={(e) => setZipFilter(e.target.value)}
            placeholder="e.g., 94105"
            className="input"
            style={{ width: '100px' }}
          />

          <label htmlFor="radius" style={{ marginLeft: '20px' }}>Radius (miles): </label>
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

        {/* Job Listings */}
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
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.title}</td>
                  <td>{job.company}</td>
                  <td>{formatLocations(job.locations)}</td>
                  <td>{job.job_types.join(', ')}</td>
                  <td>{job.remote ? 'Yes' : 'No'}</td>
                  <td>{formatSalary(job.salary_range)}</td>
                  <td>
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
  );
}