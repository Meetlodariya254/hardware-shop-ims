'use strict';

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const { config, validateEnvironment } = require('./config/environment');
const { errorHandler } = require('./middleware/errorHandler');
const { generalRateLimiter } = require('./middleware/rateLimiter');
const routes = require('./routes');
const logger = require('./utils/logger');

// Validate env vars on startup
validateEnvironment();

const app = express();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // React inline styles
      imgSrc: ["'self'", 'data:', 'blob:'],    // data: URIs for SVG icons, blob: for exports
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'", 'blob:'],           // blob: workers for PDF/Excel
      upgradeInsecureRequests: null,             // Disable for HTTP localhost
    },
  },
  crossOriginEmbedderPolicy: false,             // Keep false: Electron uses HTTP
}));

// CORS — only allow our frontend
app.use(cors({
  origin: [config.cors.frontendUrl, 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Request Parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(morgan(config.node_env === 'development' ? 'dev' : 'combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use('/api', generalRateLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: config.app.name,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.node_env,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ─── Serve Frontend ───────────────────────────────────────────────────────────
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist, {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// ─── 404 Handler (API only) ───────────────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    data: null,
    error: { code: 'ROUTE_NOT_FOUND' },
    timestamp: new Date().toISOString(),
  });
});

// ─── Catch-All for React Router ───────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ─── Global Error Handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

module.exports = app;
