type NextApiRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  body?: any;
  headers: Record<string, string | string[] | undefined>;
};

type NextApiResponse = {
  status: (code: number) => NextApiResponse;
  json: (data: any) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

import { resolveExportAuth } from '../../src/services/authToken.ts';
import {
  downloadDriveSetlistMss,
  listDriveSetlists,
} from '../../src/services/googleDriveServer.ts';

function firstQueryParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0].trim() : '';
  }
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Next.js API Route: /api/drive/setlists
 *
 * Admin-only endpoint to browse exported setlists inside structured Google Drive folders
 * or download an existing .mss file to edit and overwrite back onto Drive.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Metoda ${req.method} není povolena.` });
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const auth = resolveExportAuth(req.headers);
  if (!auth.allowOverwrite || auth.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Přístup k seznamu a správě setlistů na Disku má pouze administrátor.',
    });
  }

  try {
    const fileId = firstQueryParam(req.query?.fileId);
    if (fileId) {
      const downloaded = await downloadDriveSetlistMss(fileId);
      return res.status(200).json(downloaded);
    }

    const folderKey = firstQueryParam(req.query?.folder) || 'all';
    const listed = await listDriveSetlists(folderKey);
    return res.status(200).json(listed);
  } catch (error: any) {
    console.error('API /api/drive/setlists error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Chyba při načítání setlistů z Google Disku.',
    });
  }
}
