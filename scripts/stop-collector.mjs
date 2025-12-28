#!/usr/bin/env node

/**
 * Stop Debug Collector
 *
 * Stops the running collector process by reading its PID file.
 *
 * Usage:
 *   node scripts/stop-collector.mjs
 */

import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const DEBUG_DIR = join(process.cwd(), '.debug');
const PID_FILE = join(DEBUG_DIR, 'collector.pid');

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
 * Wait for process to terminate
 */
async function waitForTermination(pid, timeoutMs = 3000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (!isProcessRunning(pid)) {
      return true;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}

// Check if PID file exists
if (!existsSync(PID_FILE)) {
  console.log('Debug collector is not running (no PID file)');
  process.exit(0);
}

// Read PID
let pid;
try {
  pid = parseInt(readFileSync(PID_FILE, 'utf8').trim(), 10);
} catch (e) {
  console.error('Failed to read PID file:', e.message);
  process.exit(1);
}

// Check if process is running
if (!isProcessRunning(pid)) {
  console.log('Debug collector is not running (stale PID file)');
  try {
    unlinkSync(PID_FILE);
  } catch (e) {
    // Ignore cleanup errors
  }
  process.exit(0);
}

// Send SIGTERM
try {
  process.kill(pid, 'SIGTERM');
} catch (e) {
  console.error('Failed to send SIGTERM:', e.message);
  process.exit(1);
}

// Wait for termination
const terminated = await waitForTermination(pid);

if (terminated) {
  console.log(`Debug collector stopped (PID: ${pid})`);
  // Clean up PID file if collector didn't
  try {
    if (existsSync(PID_FILE)) {
      unlinkSync(PID_FILE);
    }
  } catch (e) {
    // Ignore cleanup errors
  }
} else {
  console.error('Debug collector did not terminate gracefully');
  // Try SIGKILL
  try {
    process.kill(pid, 'SIGKILL');
    console.log('Sent SIGKILL');
  } catch (e) {
    // Process might have terminated
  }
}
