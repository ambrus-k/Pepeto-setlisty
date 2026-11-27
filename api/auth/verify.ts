type NextApiRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
};

type NextApiResponse = {
  status: (code: number) => NextApiResponse;
  json: (data: any) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

import { createAuthToken, verifyPin } from '../../src/services/authToken.ts';

/**
 * Next.js API Route: /api/auth/verify
 *
 * Verifies PIN input and returns role ('user' or 'admin') with a signed session token.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Metoda ${req.method} není povolena.` });
  }

  const { pin } = req.body || {};
  const role = verifyPin(pin);

  if (role) {
    return res.status(200).json({
      success: true,
      role,
      token: createAuthToken(role),
      message: role === 'admin' ? 'Ověřeno jako Administrátor.' : 'Ověřeno jako Muzikant.',
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Zadaný PIN není platný.',
  });
}
