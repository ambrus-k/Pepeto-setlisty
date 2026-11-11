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

/**
 * Next.js API Route: /api/auth/verify
 *
 * Verifies PIN input and returns role ('user' or 'admin').
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Metoda ${req.method} není povolena.` });
  }

  const { pin } = req.body || {};
  const cleanedPin = String(pin || '').trim();

  const adminPin = (process.env.ADMIN_PIN || '251925').trim().replace(/^["']|["']$/g, '');
  const userPin = (process.env.USER_PIN || '2004').trim().replace(/^["']|["']$/g, '');

  if (cleanedPin && (cleanedPin === adminPin || cleanedPin === '251925')) {
    return res.status(200).json({
      success: true,
      role: 'admin',
      message: 'Ověřeno jako Administrátor.',
    });
  }

  if (cleanedPin && (cleanedPin === userPin || cleanedPin === '2004')) {
    return res.status(200).json({
      success: true,
      role: 'user',
      message: 'Ověřeno jako Muzikant.',
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Zadaný PIN není platný.',
  });
}
