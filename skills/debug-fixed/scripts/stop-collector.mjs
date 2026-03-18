#!/usr/bin/env node

/**
 * Stop Debug Collector
 */

import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const DEBUG_DIR = join(process.cwd(), ".debug");
const PID_FILE = join(DEBUG_DIR, "collector.pid");

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForTermination(pid, timeoutMs = 3000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (!isProcessRunning(pid)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

if (!existsSync(PID_FILE)) {
  console.log("Debug collector is not running (no PID file)");
  process.exit(0);
}

let pid;
try {
  pid = parseInt(readFileSync(PID_FILE, "utf8").trim(), 10);
} catch (error) {
  console.error("Failed to read PID file:", error.message);
  process.exit(1);
}

if (!isProcessRunning(pid)) {
  console.log("Debug collector is not running (stale PID file)");
  try {
    unlinkSync(PID_FILE);
  } catch {
    // Ignore cleanup errors.
  }
  process.exit(0);
}

try {
  process.kill(pid, "SIGTERM");
} catch (error) {
  console.error("Failed to send SIGTERM:", error.message);
  process.exit(1);
}

const terminated = await waitForTermination(pid);

if (terminated) {
  console.log(`Debug collector stopped (PID: ${pid})`);
  try {
    if (existsSync(PID_FILE)) {
      unlinkSync(PID_FILE);
    }
  } catch {
    // Ignore cleanup errors.
  }
} else {
  console.error("Debug collector did not terminate gracefully");
  try {
    process.kill(pid, "SIGKILL");
    console.log("Sent SIGKILL");
  } catch {
    // Process might have terminated already.
  }
}
