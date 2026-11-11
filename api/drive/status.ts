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

import { getServerDriveStatus } from '../../src/services/googleDriveServer';

/**
 * Next.js API Route for Vercel: /api/drive/status
 * Returns Google Drive configuration and permanent folder IDs.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Metoda ${req.method} není povolena.` });
  }

  try {
    const status = getServerDriveStatus();
    return res.status(200).json(status);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Chyba při zjišťování stavu Google Disku.',
    });
  }
}
