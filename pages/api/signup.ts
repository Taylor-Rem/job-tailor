import type { NextApiRequest, NextApiResponse } from 'next';
import { signup } from '../../lib/user';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const result = await signup(email, username, password);

  if (result.success && result.user) {
    return res.status(201).json({ message: 'User created', user: result.user });
  } else {
    return res.status(500).json({ message: 'Signup failed', error: result.error });
  }
}