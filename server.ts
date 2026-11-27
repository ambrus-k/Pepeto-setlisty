import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import {
  syncMasterSongsFromDrive,
  exportToGoogleDrive,
  uploadPdfOnlyToGoogleDrive,
  listDriveSetlists,
  downloadDriveSetlistMss,
  getServerDriveStatus,
  getAdminLogs,
  saveFolderSettings,
  testDriveConnection,
  lastParsedXlsx,
  lastParsedLegend,
} from './src/services/googleDriveServer';
import { createAuthToken, resolveExportAuth, verifyPin } from './src/services/authToken';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Support large payloads for PDF base64 / XML
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// 1. PIN & token verification endpoints
app.get('/api/auth/verify', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const auth = resolveExportAuth(req.headers as Record<string, string | string[] | undefined>);
  return res.json({
    valid: auth.tokenVerified,
    role: auth.role,
    allowOverwrite: auth.allowOverwrite,
  });
});

app.post('/api/auth/verify', (req: Request, res: Response) => {
  const { pin } = req.body || {};
  const role = verifyPin(pin);

  if (role) {
    return res.json({
      success: true,
      role,
      token: createAuthToken(role),
      message: role === 'admin' ? 'Přihlášen jako Administrátor.' : 'Přihlášen jako Muzikant.',
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Zadaný PIN není platný. Zkuste to znovu.',
  });
});

// 2. Google Drive Repertoire Sync endpoint
app.get('/api/drive/sync', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const force = req.query.force === 'true';
    const result = await syncMasterSongsFromDrive(force);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Chyba při synchronizaci repertoáru z Google Disku.',
    });
  }
});

// 3. Google Drive Export endpoint
app.post('/api/drive/export', async (req: Request, res: Response) => {
  try {
    const { fileName, mssXml, pdfBase64, pdfOnly, eventName, eventDate, confirmOverwrite } = req.body || {};
    const auth = resolveExportAuth(req.headers as Record<string, string | string[] | undefined>);
    const exportOptions = {
      allowOverwrite: auth.allowOverwrite,
      confirmOverwrite: confirmOverwrite === true,
      role: auth.role,
      tokenVerified: auth.tokenVerified,
      eventName: typeof eventName === 'string' ? eventName : undefined,
      eventDate: typeof eventDate === 'string' ? eventDate : undefined,
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
        error: 'Chybí obsah souboru .mss (mssXml).',
      });
    }

    const result = await exportToGoogleDrive(
      fileName || 'Setlist',
      mssXml,
      pdfBase64,
      exportOptions
    );
    return res.status(result.statusCode || (result.success ? 200 : 500)).json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Chyba při exportu na Google Disk.',
    });
  }
});

// 3b. Admin-only Google Drive Setlists browser & loader
app.get('/api/drive/setlists', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const auth = resolveExportAuth(req.headers as Record<string, string | string[] | undefined>);
  if (!auth.allowOverwrite || auth.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Přístup k seznamu a správě setlistů na Disku má pouze administrátor.',
    });
  }

  try {
    const fileId = typeof req.query.fileId === 'string' ? req.query.fileId.trim() : '';
    if (fileId) {
      const downloaded = await downloadDriveSetlistMss(fileId);
      return res.json(downloaded);
    }

    const folderKey = typeof req.query.folder === 'string' ? req.query.folder.trim() : 'all';
    const listed = await listDriveSetlists(folderKey || 'all');
    return res.json(listed);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Chyba při načítání setlistů z Google Disku.',
    });
  }
});

// 4. Save Folder Settings endpoint
app.post('/api/drive/folders', (req: Request, res: Response) => {
  const { rootFolderId, dataFolderId, osaFolderId, exportFolderId } = req.body || {};
  const updated = saveFolderSettings({
    rootFolderId: rootFolderId || exportFolderId,
    dataFolderId,
    osaFolderId,
  });
  return res.json({ success: true, ...updated });
});

// 5. Test Google Drive Connection endpoint
app.get('/api/drive/test', async (_req: Request, res: Response) => {
  try {
    const report = await testDriveConnection();
    return res.json(report);
  } catch (err: any) {
    return res.status(500).json({
      authOk: false,
      overallStatus: 'ERROR',
      message: err.message || 'Chyba při testování spojení.',
    });
  }
});

// 6. Server & Google Drive status
app.get('/api/drive/status', (_req: Request, res: Response) => {
  const status = getServerDriveStatus();
  return res.json(status);
});

// 7. Admin server logs
app.get('/api/admin/logs', (_req: Request, res: Response) => {
  const logs = getAdminLogs();
  return res.json({ logs });
});

// 8. Debug XLSX items & legend
app.get('/api/drive/debug-xlsx', (_req: Request, res: Response) => {
  return res.json({ count: lastParsedXlsx.length, legend: lastParsedLegend, items: lastParsedXlsx });
});

// Vite dev server mounting or static file serving
async function startServer() {
  if (!isProduction) {
    // Dynamic import of Vite in dev
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 MobileSheets Setlist Studio backend běží na portu ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
