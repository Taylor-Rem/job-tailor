declare module 'jsonresume-theme-elegant' {
  interface ResumeData {
    basics: {
      name: string;
      email: string;
      phone: string;
      url: string;
      location?: {
        address: string;
        postalCode: string;
        city: string;
        countryCode: string;
        region: string;
      };
    };
    summary: string;
    skills: { name: string }[];
    work: { position: string; company: string; startDate: string; endDate: string; summary: string }[];
    education: { institution: string; area: string; studyType: string; startDate: string; endDate: string }[];
    [key: string]: any; // Allow extra fields
  }

  function render(resume: ResumeData): string;

  export = { render };
}