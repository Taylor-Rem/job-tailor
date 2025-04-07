import type { NextApiRequest, NextApiResponse } from 'next';
import { login } from '../../lib/user';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const result = await login(identifier, password);

  if (result.success && result.user) {
    return res.status(200).json({ message: 'Login successful', user: result.user });
  } else {
    return res.status(401).json({ message: 'Login failed', error: result.error });
  }
}