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

import { saveFolderSettings } from '../../src/services/googleDriveServer.ts';

/**
 * Next.js API Route for Vercel: /api/drive/folders
 * Saves updated Google Drive folder IDs (only accessible by admin).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Metoda ${req.method} není povolena.` });
  }

  try {
    const { dataFolderId, exportFolderId } = req.body || {};
    const updated = saveFolderSettings(dataFolderId || '', exportFolderId || '');
    return res.status(200).json({ success: true, ...updated });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Chyba při ukládání nastavení složek.',
    });
  }
}
