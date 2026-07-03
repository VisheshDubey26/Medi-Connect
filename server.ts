import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import adminRouter from './src/api/admin.ts';
import doctorRouter from './src/api/doctor.ts';
import patientRouter from './src/api/patient.ts';
import appointmentsRouter from './src/api/appointments.ts';
import authRouter from './src/api/auth.ts';
import { BackgroundTaskManager } from './src/services/tasks.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middlewares
  app.use(express.json());

  // Security Headers (Helmet Equivalent)
  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Mount API Routers
  app.use('/api/admin', adminRouter);
  app.use('/api/doctor', doctorRouter);
  app.use('/api/patient', patientRouter);
  app.use('/api/appointments', appointmentsRouter);
  app.use('/api/auth', authRouter);

  // Start Background Task Worker (Processes slot holds, medication alerts, and AI retries every 30 seconds)
  BackgroundTaskManager.start(30000);

  // Vite integration for asset serving & SPA Routing
  if (process.env.NODE_ENV !== 'production') {
    console.log('Mounting Vite dev server middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Serving production static build files...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Graceful shutdown
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`===================================================`);
    console.log(`Server running successfully on http://localhost:${PORT}`);
    console.log(`===================================================`);
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server...');
    BackgroundTaskManager.stop();
    server.close(() => {
      console.log('HTTP server closed.');
    });
  });
}

startServer();
