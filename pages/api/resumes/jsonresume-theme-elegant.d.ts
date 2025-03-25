declare module 'jsonresume-theme-elegant' {
    interface ResumeData {
      basics?: { name?: string; email?: string; phone?: string; url?: string };
      summary?: string;
      skills?: { name: string }[];
      work?: { position: string; company: string; startDate?: string; endDate?: string; summary?: string }[];
      education?: { institution: string; area: string; studyType: string; startDate?: string; endDate?: string }[];
      [key: string]: any;
    }
  
    function render(resume: ResumeData): string;
  
    export = { render };
  }