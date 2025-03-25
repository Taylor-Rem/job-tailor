async function tailorResume(summary: string, skills: string[], jobDescription: string) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-2024-07-18',
        messages: [
          {
            role: 'system',
            content: 'Return a JSON object with "summary" (string) and "skills" (array of {"name": string}). Rewrite the summary and customize skills based on the job description, using the provided summary and skills as a base. Optimize for the job’s needs. Return only the JSON.',
          },
          {
            role: 'user',
            content: `Original summary: "${summary}", original skills: ${JSON.stringify(skills)}, job description: "${jobDescription}"`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 500,
      }),
    });
  
    if (!response.ok) throw new Error('OpenAI API failed: ' + await response.text());
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  }
  
  export { tailorResume };