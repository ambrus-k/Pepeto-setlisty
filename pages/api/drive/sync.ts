// Next.js API route request/response interface compatible with Next.js & Node.js
type NextApiRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  body: any;
  headers: Record<string, string | string[] | undefined>;
};

type NextApiResponse = {
  status: (code: number) => NextApiResponse;
  json: (data: any) => void;
  setHeader: (name: string, value: string | string[]) => void;
};
import { syncMasterSongsFromDrive } from '../../../src/services/googleDriveServer';

/**
 * Next.js API Route: /api/drive/sync
 * ----------------------------------------------------------------------------
 * NÁVOD PRO VYTVOŘENÍ SERVICE ACCOUNTU V GOOGLE CLOUD CONSOLE:
 * 1. Otevřete Google Cloud Console: https://console.cloud.google.com
 * 2. Vytvořte nový projekt (např. "MobileSheets-Setlists").
 * 3. V menu "APIs & Services > Library" vyhledejte a povolte "Google Drive API".
 * 4. V menu "IAM & Admin > Service Accounts" klikněte na "+ Create Service Account".
 *    Zadejte název (např. "setlist-bot") a klikněte na "Create and Continue" -> "Done".
 * 5. Rozklikněte vytvořený účet, otevřete záložku "Keys" -> "Add Key" -> "Create new key" (JSON).
 * 6. Zkopírujte:
 *    - client_email -> do GOOGLE_CLIENT_EMAIL v .env
 *    - private_key  -> do GOOGLE_PRIVATE_KEY v .env
 * 7. Na Google Disku nasdílejte složku s daty a složku s exporty na e-mail servisního účtu (s právy Editor)!
 * ----------------------------------------------------------------------------
 *
 * Downloads PEPETO_KOMPLET_SETLIST.mss and PEPETA_KOMPLET.xlsx from Google Drive Data folder
 * using Service Account credentials, parses with ExcelJS on server, pairs them, and returns clean JSON.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Metoda ${req.method} není povolena.` });
  }

  try {
    const force = req.query.force === 'true';
    const result = await syncMasterSongsFromDrive(force);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('API /api/drive/sync error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Chyba při synchronizaci skladeb z Google Disku.',
    });
  }
}
