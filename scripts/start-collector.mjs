#!/usr/bin/env node

/**
 * Start Debug Collector
 *
 * Spawns the collector as a detached background process.
 * If already running, prints status and exits.
 *
 * Usage:
 *   node scripts/start-collector.mjs
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEBUG_DIR = join(process.cwd(), '.debug');
const PID_FILE = join(DEBUG_DIR, 'collector.pid');
const COLLECTOR_SCRIPT = join(__dirname, 'collector.mjs');

/**
 * Check if a process with given PID is running
 */
function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Check if collector is already running
 */
function getRunningPid() {
  if (!existsSync(PID_FILE)) {
    return null;
  }
  try {
    const pid = parseInt(readFileSync(PID_FILE, 'utf8').trim(), 10);
    if (isProcessRunning(pid)) {
      return pid;
    }
  } catch (e) {
    // Ignore read errors
  }
  return null;
}

/**
 * Wait for collector to start
 */
async function waitForStart(timeoutMs = 3000) {
  const port = process.env.DEBUG_PORT || '7777';
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        return true;
      }
    } catch (e) {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}

// Check if already running
const existingPid = getRunningPid();
if (existingPid) {
  console.log(`Debug collector already running (PID: ${existingPid})`);
  process.exit(0);
}

// Spawn collector as detached background process
const child = spawn(process.execPath, [COLLECTOR_SCRIPT], {
  detached: true,
  stdio: 'ignore',
  env: { ...process.env }
});

child.unref();

// Wait for it to start
const started = await waitForStart();

if (started) {
  // Read the PID from file (collector writes it)
  try {
    const pid = readFileSync(PID_FILE, 'utf8').trim();
    console.log(`Debug collector started (PID: ${pid})`);
    console.log(`Log file: ${join(DEBUG_DIR, 'debug.log')}`);
  } catch (e) {
    console.log('Debug collector started');
  }
} else {
  console.error('Failed to start debug collector');
  process.exit(1);
}
