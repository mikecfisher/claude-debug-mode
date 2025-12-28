#!/usr/bin/env node

/**
 * Tail Debug Logs
 *
 * Watches the debug log file and pretty-prints new entries in real-time.
 *
 * Usage:
 *   node scripts/tail-logs.mjs
 *   node scripts/tail-logs.mjs --hypothesis A
 *
 * Options:
 *   --hypothesis, -h <id>  Filter to specific hypothesis
 */

import { existsSync, readFileSync, statSync, watch } from 'node:fs';
import { join } from 'node:path';

const DEBUG_DIR = join(process.cwd(), '.debug');
const LOG_FILE = join(DEBUG_DIR, 'debug.log');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

// Hypothesis colors (cycle through for many hypotheses)
const hypothesisColors = {
  'A': colors.cyan,
  'B': colors.yellow,
  'C': colors.magenta,
  'D': colors.green,
  'E': colors.blue,
};

// Level colors
const levelColors = {
  'error': colors.red,
  'warn': colors.yellow,
  'info': colors.white,
  'debug': colors.gray,
  'trace': colors.dim,
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = { hypothesis: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--hypothesis' || args[i] === '-h') {
      options.hypothesis = args[++i];
    }
  }

  return options;
}

/**
 * Format timestamp as HH:MM:SS.mmm
 */
function formatTime(timestamp) {
  const d = new Date(timestamp);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

/**
 * Get color for hypothesis ID
 */
function getHypothesisColor(id) {
  if (hypothesisColors[id]) {
    return hypothesisColors[id];
  }
  // For other IDs, cycle through colors
  const colorList = [colors.cyan, colors.yellow, colors.magenta, colors.green, colors.blue];
  return colorList[id.charCodeAt(0) % colorList.length];
}

/**
 * Format and print a log entry
 */
function printEntry(entry) {
  const time = formatTime(entry.timestamp || Date.now());
  const hypothesisColor = getHypothesisColor(entry.hypothesisId);
  const level = entry.level || 'info';
  const levelColor = levelColors[level] || colors.white;

  // Header line: [HH:MM:SS.mmm] [H] [level] location
  console.log(
    `${colors.gray}[${time}]${colors.reset} ` +
    `${hypothesisColor}[${entry.hypothesisId}]${colors.reset} ` +
    `${levelColor}[${level}]${colors.reset} ` +
    `${colors.bold}${entry.location}${colors.reset}`
  );

  // Message line
  console.log(`  ${colors.dim}→${colors.reset} ${entry.message}`);

  // Data line (if present)
  if (entry.data !== undefined && entry.data !== null) {
    const dataStr = typeof entry.data === 'string'
      ? entry.data
      : JSON.stringify(entry.data, null, 2).split('\n').join('\n    ');
    console.log(`  ${colors.dim}→ data:${colors.reset} ${dataStr}`);
  }

  // Blank line for readability
  console.log();
}

/**
 * Process new lines from the log file
 */
function processNewLines(lines, filter) {
  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);

      // Apply hypothesis filter
      if (filter.hypothesis && entry.hypothesisId !== filter.hypothesis) {
        continue;
      }

      printEntry(entry);
    } catch (e) {
      // Skip malformed lines
      console.error(`${colors.red}[parse error]${colors.reset} ${line}`);
    }
  }
}

/**
 * Main tail function
 */
async function tailLogs(options) {
  let lastSize = 0;
  let buffer = '';

  // Print header
  console.log(`${colors.bold}=== Debug Log Tail ===${colors.reset}`);
  console.log(`${colors.gray}Watching: ${LOG_FILE}${colors.reset}`);
  if (options.hypothesis) {
    console.log(`${colors.gray}Filtering: hypothesis ${options.hypothesis}${colors.reset}`);
  }
  console.log(`${colors.gray}Press Ctrl+C to stop${colors.reset}`);
  console.log();

  // Wait for file to exist
  while (!existsSync(LOG_FILE)) {
    await new Promise(r => setTimeout(r, 500));
  }

  // Get initial size
  try {
    lastSize = statSync(LOG_FILE).size;
  } catch (e) {
    lastSize = 0;
  }

  // Read and process new content
  function readNewContent() {
    try {
      const currentSize = statSync(LOG_FILE).size;

      // File was truncated or replaced
      if (currentSize < lastSize) {
        lastSize = 0;
        buffer = '';
      }

      if (currentSize > lastSize) {
        // Read new content
        const fileContent = readFileSync(LOG_FILE, 'utf8');
        const newContent = fileContent.slice(lastSize);
        lastSize = currentSize;

        // Handle partial lines
        buffer += newContent;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        processNewLines(lines, options);
      }
    } catch (e) {
      // File might have been deleted
      if (!existsSync(LOG_FILE)) {
        lastSize = 0;
        buffer = '';
      }
    }
  }

  // Watch for changes
  const watcher = watch(DEBUG_DIR, { persistent: true }, (eventType, filename) => {
    if (filename === 'debug.log') {
      readNewContent();
    }
  });

  // Also poll periodically (some systems don't fire watch events reliably)
  const pollInterval = setInterval(readNewContent, 500);

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log(`\n${colors.gray}Stopped watching${colors.reset}`);
    watcher.close();
    clearInterval(pollInterval);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    watcher.close();
    clearInterval(pollInterval);
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}

// Run
const options = parseArgs();
tailLogs(options);
