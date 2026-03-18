#!/usr/bin/env node

/**
 * Clear Debug Logs
 */

import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DEBUG_DIR = join(process.cwd(), ".debug");
const LOG_FILE = join(DEBUG_DIR, "debug.log");

if (!existsSync(LOG_FILE)) {
  console.log("No log file to clear");
  process.exit(0);
}

try {
  writeFileSync(LOG_FILE, "");
  console.log("Debug logs cleared");
} catch (error) {
  console.error("Failed to clear logs:", error.message);
  process.exit(1);
}
