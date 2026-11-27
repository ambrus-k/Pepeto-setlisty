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

import { createAuthToken, resolveExportAuth, verifyPin } from '../../src/services/authToken.ts';

/**
 * Next.js API Route: /api/auth/verify
 *
 * GET: Verifies whether the current session token is valid on the server (and whether overwrite is allowed).
 * POST: Verifies PIN input and returns role ('user' or 'admin') with a signed session token.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    const auth = resolveExportAuth(req.headers);
    return res.status(200).json({
      valid: auth.tokenVerified,
      role: auth.role,
      allowOverwrite: auth.allowOverwrite,
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
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
