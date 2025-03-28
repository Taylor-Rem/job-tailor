declare module 'jsonresume-theme-actual' {
    interface ResumeData {
      basics: {
        name: string;
        label?: string;
        image?: string;
        email: string;
        phone: string;
        url?: string;
        summary?: string;
        location: {
          address?: string;
          postalCode?: string;
          city?: string;
          countryCode?: string;
          region?: string;
        };
        profiles?: { network: string; username: string; url: string }[];
      };
      work: { name: string; position: string; url?: string; startDate: string; endDate: string; summary: string; highlights?: string[] }[];
      education: { institution: string; area?: string; studyType: string; startDate: string; endDate: string; score?: string; courses?: string[] }[];
      skills: { name: string; level?: string; keywords?: string[] }[];
      projects: { name: string; startDate?: string; endDate?: string; description: string; highlights?: string[]; url?: string }[];
      volunteer?: { organization: string; position: string; url?: string; startDate: string; endDate: string; summary: string; highlights?: string[] }[];
      awards?: { title: string; date: string; awarder: string; summary: string }[];
      certificates?: { name: string; date: string; issuer: string; url?: string }[];
      publications?: { name: string; publisher: string; releaseDate: string; url?: string; summary: string }[];
      languages?: { language: string; fluency: string }[];
      interests?: { name: string; keywords: string[] }[];
      references?: { name: string; reference: string }[];
      [key: string]: any; // Allow extra fields
    }
  
    function render(resume: ResumeData): string;
  
    export = { render };
  }