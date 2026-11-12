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

import { testDriveConnection } from '../../src/services/googleDriveServer.ts';

/**
 * Next.js API Route for Vercel: /api/drive/test
 * Tests Google Drive authorization and verifies access to data & export folders.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Metoda ${req.method} není povolena.` });
  }

  try {
    const report = await testDriveConnection();
    return res.status(200).json(report);
  } catch (error: any) {
    return res.status(500).json({
      authOk: false,
      overallStatus: 'ERROR',
      message: error.message || 'Chyba při testování spojení.',
    });
  }
}
