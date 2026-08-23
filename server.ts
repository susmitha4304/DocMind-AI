import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

// Load environment variables
dotenv.config();

// Import route modules
import authRouter from './server/routes/auth.js';
import docsRouter from './server/routes/documents.js';
import chatRouter from './server/routes/chat.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set payload size limits for base64 file uploads (PDF, DOCX, etc.)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Debug logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/documents', docsRouter);
  app.use('/api/chat', chatRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`========================================`);
    console.log(` DocMind AI Full-Stack Server Running   `);
    console.log(` Address: http://0.0.0.0:${PORT}        `);
    console.log(` Environment: ${process.env.NODE_ENV || 'development'} `);
    console.log(`========================================`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
