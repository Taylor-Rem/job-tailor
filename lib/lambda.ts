// lib/lambda.ts
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID!,
    secretAccessKey: process.env.SECRET_ACCESS_KEY!,
  },
});

export async function parseResume(user_id: number, s3Key: string, file_name: string, resumeText: string, base_url: string) {
  const lambdaPayload = {
    user_id,
    s3Key,
    file_name,
    resumeText,
    base_url,
  };

  try {
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: 'parseResumeFunction',
        InvocationType: 'Event',
        Payload: JSON.stringify(lambdaPayload),
      })
    );
    return { success: true, message: 'Resume parsing triggered' };
  } catch (error) {
    console.error('Error triggering Lambda:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to trigger parsing' };
  }
}

export { lambdaClient };