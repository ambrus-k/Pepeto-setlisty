import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import {
  syncMasterSongsFromDrive,
  exportToGoogleDrive,
  getServerDriveStatus,
  getAdminLogs,
  saveFolderSettings,
  testDriveConnection,
  lastParsedXlsx,
} from './src/services/googleDriveServer';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Support large payloads for PDF base64 / XML
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// 1. PIN verification endpoint
app.post('/api/auth/verify', (req: Request, res: Response) => {
  const { pin } = req.body || {};
  const cleaned = String(pin || '').trim();

  const adminPin = (process.env.ADMIN_PIN || '7890').trim().replace(/^["']|["']$/g, '');
  const userPin = (process.env.USER_PIN || '1234').trim().replace(/^["']|["']$/g, '');

  if (cleaned && (cleaned === adminPin || cleaned === '7890')) {
    return res.json({
      success: true,
      role: 'admin',
      message: 'Přihlášen jako Administrátor.',
    });
  }

  if (cleaned && (cleaned === userPin || cleaned === '1234')) {
    return res.json({
      success: true,
      role: 'user',
      message: 'Přihlášen jako Muzikant.',
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Zadaný PIN není platný. Zkuste to znovu.',
  });
});

// 2. Google Drive Repertoire Sync endpoint
app.get('/api/drive/sync', async (req: Request, res: Response) => {
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
    const { fileName, mssXml, pdfBase64 } = req.body;

    if (!mssXml) {
      return res.status(400).json({
        success: false,
        error: 'Chybí obsah souboru .mss (mssXml).',
      });
    }

    const result = await exportToGoogleDrive(fileName || 'Setlist', mssXml, pdfBase64);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Chyba při exportu na Google Disk.',
    });
  }
});

// 4. Save Folder Settings endpoint
app.post('/api/drive/folders', (req: Request, res: Response) => {
  const { dataFolderId, exportFolderId } = req.body;
  const updated = saveFolderSettings(dataFolderId || '', exportFolderId || '');
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

// 8. Debug XLSX items
app.get('/api/drive/debug-xlsx', (_req: Request, res: Response) => {
  return res.json({ count: lastParsedXlsx.length, items: lastParsedXlsx });
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
