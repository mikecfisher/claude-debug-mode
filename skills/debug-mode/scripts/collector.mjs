#!/usr/bin/env node

/**
 * Debug Log Collector Server
 *
 * HTTP server that collects debug log entries and writes them to .debug/debug.log
 */

import { createServer } from "node:http";
import { appendFileSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = parseInt(process.env.DEBUG_PORT || "7777", 10);
const DEBUG_DIR = join(process.cwd(), ".debug");
const LOG_FILE = join(DEBUG_DIR, "debug.log");
const PID_FILE = join(DEBUG_DIR, "collector.pid");

if (!existsSync(DEBUG_DIR)) {
  mkdirSync(DEBUG_DIR, { recursive: true });
}

writeFileSync(PID_FILE, process.pid.toString());

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function validateEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return "Entry must be a JSON object";
  }
  if (!entry.location || typeof entry.location !== "string") {
    return "Missing required field: location";
  }
  if (!entry.message || typeof entry.message !== "string") {
    return "Missing required field: message";
  }
  if (!entry.hypothesisId || typeof entry.hypothesisId !== "string") {
    return "Missing required field: hypothesisId";
  }
  return null;
}

function writeLogEntry(entry) {
  if (!entry.timestamp) {
    entry.timestamp = Date.now();
  }
  appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    ...corsHeaders,
  });
  res.end(JSON.stringify(data));
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method === "GET" && path === "/") {
    res.writeHead(200, {
      "Content-Type": "text/html",
      ...corsHeaders,
    });
    res.end(
      `
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
    `.trim(),
    );
    return;
  }

  if (req.method === "GET" && path === "/health") {
    sendJson(res, 200, { status: "ok", pid: process.pid });
    return;
  }

  if (req.method === "POST" && path === "/ingest") {
    try {
      const entry = await parseBody(req);
      const error = validateEntry(entry);
      if (error) {
        sendJson(res, 400, { status: "error", error });
        return;
      }
      writeLogEntry(entry);
      sendJson(res, 200, { status: "ok" });
    } catch (error) {
      sendJson(res, 400, { status: "error", error: error.message });
    }
    return;
  }

  if (path === "/ingest" || path === "/health") {
    res.writeHead(405, {
      Allow: path === "/ingest" ? "POST, OPTIONS" : "GET, OPTIONS",
      ...corsHeaders,
    });
    res.end("Method Not Allowed");
    return;
  }

  res.writeHead(404, corsHeaders);
  res.end("Not Found");
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error("Request error:", error);
    sendJson(res, 500, { status: "error", error: "Internal server error" });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.error(`Debug collector listening on http://127.0.0.1:${PORT}`);
  console.error(`Log file: ${LOG_FILE}`);
  console.error(`PID: ${process.pid}`);
});

function shutdown(signal) {
  console.error(`\nReceived ${signal}, shutting down...`);
  server.close(() => {
    try {
      if (existsSync(PID_FILE)) {
        unlinkSync(PID_FILE);
      }
    } catch {
      // Ignore cleanup errors.
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
