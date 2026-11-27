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
import { exportToGoogleDrive, uploadPdfOnlyToGoogleDrive } from '../../src/services/googleDriveServer.ts';
import { resolveExportAuth } from '../../src/services/authToken.ts';

/**
 * Next.js API Route: /api/drive/export
 *
 * Receives the generated MobileSheets XML (.mss) string and optional PDF (or PDF-only OSA list) from the frontend,
 * and uses the Drive credentials to upload it silently into the export folder on Google Drive.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Metoda ${req.method} není povolena.` });
  }

  try {
    const { fileName, mssXml, pdfBase64, pdfOnly } = req.body || {};
    const auth = resolveExportAuth(req.headers);
    const exportOptions = {
      allowOverwrite: auth.allowOverwrite,
      role: auth.role,
    };

    if (pdfOnly || (!mssXml && pdfBase64)) {
      if (!pdfBase64) {
        return res.status(400).json({
          success: false,
          error: 'Chybí povinný obsah souboru PDF (pdfBase64).',
        });
      }
      const result = await uploadPdfOnlyToGoogleDrive(
        fileName || 'Seznam pro OSA',
        pdfBase64,
        exportOptions
      );
      return res.status(result.statusCode || (result.success ? 200 : 500)).json(result);
    }

    if (!mssXml) {
      return res.status(400).json({
        success: false,
        error: 'Chybí povinný obsah souboru XML (.mss).',
      });
    }

    const result = await exportToGoogleDrive(
      fileName || 'Setlist',
      mssXml,
      pdfBase64,
      exportOptions
    );
    return res.status(result.statusCode || (result.success ? 200 : 500)).json(result);
  } catch (error: any) {
    console.error('API /api/drive/export error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Chyba při exportu na Google Disk.',
    });
  }
}
