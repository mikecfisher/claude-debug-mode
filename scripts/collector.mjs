#!/usr/bin/env node

/**
 * Debug Log Collector Server
 *
 * HTTP server that collects debug log entries and writes them to .debug/debug.log
 *
 * Endpoints:
 *   POST /ingest - Accept JSON log entries
 *   GET /health  - Health check
 *   GET /        - Status page
 *
 * Usage:
 *   node scripts/collector.mjs
 *   DEBUG_PORT=8080 node scripts/collector.mjs
 */

import { createServer } from 'node:http';
import { appendFileSync, mkdirSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const PORT = parseInt(process.env.DEBUG_PORT || '7777', 10);
const DEBUG_DIR = join(process.cwd(), '.debug');
const LOG_FILE = join(DEBUG_DIR, 'debug.log');
const PID_FILE = join(DEBUG_DIR, 'collector.pid');

// Ensure .debug directory exists
if (!existsSync(DEBUG_DIR)) {
  mkdirSync(DEBUG_DIR, { recursive: true });
}

// Write PID file
writeFileSync(PID_FILE, process.pid.toString());

// CORS headers for browser-based logging
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Parse request body as JSON
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Validate log entry has required fields
 */
function validateEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return 'Entry must be a JSON object';
  }
  if (!entry.location || typeof entry.location !== 'string') {
    return 'Missing required field: location';
  }
  if (!entry.message || typeof entry.message !== 'string') {
    return 'Missing required field: message';
  }
  if (!entry.hypothesisId || typeof entry.hypothesisId !== 'string') {
    return 'Missing required field: hypothesisId';
  }
  return null;
}

/**
 * Write log entry to file
 */
function writeLogEntry(entry) {
  // Add timestamp if not present
  if (!entry.timestamp) {
    entry.timestamp = Date.now();
  }
  appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

/**
 * Send JSON response
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    ...corsHeaders
  });
  res.end(JSON.stringify(data));
}

/**
 * Handle HTTP requests
 */
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // GET / - Status page
  if (req.method === 'GET' && path === '/') {
    res.writeHead(200, {
      'Content-Type': 'text/html',
      ...corsHeaders
    });
    res.end(`
<!DOCTYPE html>
<html>
<head><title>Debug Collector</title></head>
<body>
  <h1>Debug Log Collector</h1>
  <p>Status: <strong style="color: green">Running</strong></p>
  <p>PID: ${process.pid}</p>
  <p>Log file: ${LOG_FILE}</p>
  <h2>Endpoints</h2>
  <ul>
    <li><code>POST /ingest</code> - Submit log entries</li>
    <li><code>GET /health</code> - Health check</li>
  </ul>
</body>
</html>
    `.trim());
    return;
  }

  // GET /health - Health check
  if (req.method === 'GET' && path === '/health') {
    sendJson(res, 200, { status: 'ok', pid: process.pid });
    return;
  }

  // POST /ingest - Accept log entries
  if (req.method === 'POST' && path === '/ingest') {
    try {
      const entry = await parseBody(req);
      const error = validateEntry(entry);
      if (error) {
        sendJson(res, 400, { status: 'error', error });
        return;
      }
      writeLogEntry(entry);
      sendJson(res, 200, { status: 'ok' });
    } catch (e) {
      sendJson(res, 400, { status: 'error', error: e.message });
    }
    return;
  }

  // 405 Method Not Allowed for other methods on known paths
  if (path === '/ingest' || path === '/health') {
    res.writeHead(405, {
      'Allow': path === '/ingest' ? 'POST, OPTIONS' : 'GET, OPTIONS',
      ...corsHeaders
    });
    res.end('Method Not Allowed');
    return;
  }

  // 404 Not Found
  res.writeHead(404, corsHeaders);
  res.end('Not Found');
}

// Create and start server
const server = createServer((req, res) => {
  handleRequest(req, res).catch(err => {
    console.error('Request error:', err);
    sendJson(res, 500, { status: 'error', error: 'Internal server error' });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.error(`Debug collector listening on http://127.0.0.1:${PORT}`);
  console.error(`Log file: ${LOG_FILE}`);
  console.error(`PID: ${process.pid}`);
});

// Graceful shutdown
function shutdown(signal) {
  console.error(`\nReceived ${signal}, shutting down...`);
  server.close(() => {
    try {
      if (existsSync(PID_FILE)) {
        unlinkSync(PID_FILE);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    process.exit(0);
  });
  // Force exit after 5 seconds
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
