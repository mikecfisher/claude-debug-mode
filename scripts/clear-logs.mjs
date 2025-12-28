#!/usr/bin/env node

/**
 * Clear Debug Logs
 *
 * Truncates the debug log file to empty.
 *
 * Usage:
 *   node scripts/clear-logs.mjs
 */

import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DEBUG_DIR = join(process.cwd(), '.debug');
const LOG_FILE = join(DEBUG_DIR, 'debug.log');

if (!existsSync(LOG_FILE)) {
  console.log('No log file to clear');
  process.exit(0);
}

try {
  writeFileSync(LOG_FILE, '');
  console.log('Debug logs cleared');
} catch (e) {
  console.error('Failed to clear logs:', e.message);
  process.exit(1);
}
