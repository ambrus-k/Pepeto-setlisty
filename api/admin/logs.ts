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
import { getAdminLogs } from '../../src/services/googleDriveServer.ts';

/**
 * Next.js API Route: /api/admin/logs
 *
 * Returns server and Google Drive audit logs for the admin panel.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Metoda ${req.method} není povolena.` });
  }

  const logs = getAdminLogs();
  return res.status(200).json({ logs });
}
