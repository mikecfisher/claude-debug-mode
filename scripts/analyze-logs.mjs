#!/usr/bin/env node

/**
 * Analyze Debug Logs
 *
 * Parses the debug log file and produces a summary grouped by hypothesis.
 *
 * Usage:
 *   node scripts/analyze-logs.mjs
 *   node scripts/analyze-logs.mjs --json
 *   node scripts/analyze-logs.mjs --hypothesis A
 *
 * Options:
 *   --json              Output raw JSON instead of formatted text
 *   --hypothesis, -h    Filter to specific hypothesis ID
 */

import { existsSync, readFileSync } from 'node:fs';
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
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = { json: false, hypothesis: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') {
      options.json = true;
    } else if (args[i] === '--hypothesis' || args[i] === '-h') {
      options.hypothesis = args[++i];
    }
  }

  return options;
}

/**
 * Format duration in human readable form
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(1);
  return `${mins}m ${secs}s`;
}

/**
 * Format timestamp for display
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
 * Parse log file into entries
 */
function parseLogFile() {
  if (!existsSync(LOG_FILE)) {
    return [];
  }

  const content = readFileSync(LOG_FILE, 'utf8');
  const lines = content.trim().split('\n').filter(l => l.trim());
  const entries = [];

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch (e) {
      // Skip malformed lines
    }
  }

  return entries;
}

/**
 * Analyze entries and group by hypothesis
 */
function analyzeEntries(entries, filterHypothesis) {
  const analysis = {
    total: 0,
    timeRange: { first: null, last: null, duration: 0 },
    hypotheses: {},
    errors: [],
  };

  for (const entry of entries) {
    // Apply filter
    if (filterHypothesis && entry.hypothesisId !== filterHypothesis) {
      continue;
    }

    analysis.total++;

    // Track time range
    const ts = entry.timestamp || Date.now();
    if (!analysis.timeRange.first || ts < analysis.timeRange.first) {
      analysis.timeRange.first = ts;
    }
    if (!analysis.timeRange.last || ts > analysis.timeRange.last) {
      analysis.timeRange.last = ts;
    }

    // Group by hypothesis
    const hId = entry.hypothesisId;
    if (!analysis.hypotheses[hId]) {
      analysis.hypotheses[hId] = {
        count: 0,
        levels: {},
        locations: {},
        errors: [],
        firstTimestamp: ts,
        lastTimestamp: ts,
      };
    }

    const h = analysis.hypotheses[hId];
    h.count++;

    // Track timestamps
    if (ts < h.firstTimestamp) h.firstTimestamp = ts;
    if (ts > h.lastTimestamp) h.lastTimestamp = ts;

    // Count by level
    const level = entry.level || 'info';
    h.levels[level] = (h.levels[level] || 0) + 1;

    // Count by location
    h.locations[entry.location] = (h.locations[entry.location] || 0) + 1;

    // Track errors
    if (level === 'error') {
      const errorInfo = {
        timestamp: ts,
        location: entry.location,
        message: entry.message,
        data: entry.data,
      };
      h.errors.push(errorInfo);
      analysis.errors.push({ ...errorInfo, hypothesisId: hId });
    }
  }

  // Calculate duration
  if (analysis.timeRange.first && analysis.timeRange.last) {
    analysis.timeRange.duration = analysis.timeRange.last - analysis.timeRange.first;
  }

  return analysis;
}

/**
 * Output analysis as formatted text
 */
function outputText(analysis) {
  console.log(`${colors.bold}=== Debug Log Analysis ===${colors.reset}`);
  console.log(`Total events: ${analysis.total}`);

  if (analysis.timeRange.first) {
    console.log(
      `Time range: ${formatTime(analysis.timeRange.first)} - ` +
      `${formatTime(analysis.timeRange.last)} ` +
      `(${formatDuration(analysis.timeRange.duration)})`
    );
  }
  console.log();

  // Sort hypotheses alphabetically
  const sortedHypotheses = Object.keys(analysis.hypotheses).sort();

  for (const hId of sortedHypotheses) {
    const h = analysis.hypotheses[hId];

    console.log(`${colors.cyan}--- Hypothesis ${hId} (${h.count} events) ---${colors.reset}`);

    // Levels breakdown
    const levelParts = Object.entries(h.levels)
      .map(([level, count]) => {
        const color = level === 'error' ? colors.red : level === 'warn' ? colors.yellow : '';
        return `${color}${count} ${level}${color ? colors.reset : ''}`;
      });
    console.log(`Levels: ${levelParts.join(', ')}`);

    // Locations
    console.log('Locations:');
    const sortedLocations = Object.entries(h.locations)
      .sort((a, b) => b[1] - a[1]); // Sort by count descending
    for (const [location, count] of sortedLocations) {
      console.log(`  - ${location} (${count} events)`);
    }

    // Errors
    if (h.errors.length > 0) {
      console.log(`${colors.red}Errors:${colors.reset}`);
      for (const err of h.errors) {
        console.log(`  ${colors.gray}[${formatTime(err.timestamp)}]${colors.reset} ${err.location}`);
        console.log(`    ${colors.red}${err.message}${colors.reset}`);
        if (err.data) {
          const dataStr = typeof err.data === 'string' ? err.data : JSON.stringify(err.data);
          console.log(`    ${colors.dim}data: ${dataStr}${colors.reset}`);
        }
      }
    } else {
      console.log(`${colors.green}Errors: None${colors.reset}`);
    }

    console.log();
  }

  // Summary
  console.log(`${colors.bold}=== Summary ===${colors.reset}`);

  if (analysis.errors.length > 0) {
    // Group errors by hypothesis
    const errorsByH = {};
    for (const err of analysis.errors) {
      if (!errorsByH[err.hypothesisId]) {
        errorsByH[err.hypothesisId] = 0;
      }
      errorsByH[err.hypothesisId]++;
    }

    const sortedByErrors = Object.entries(errorsByH).sort((a, b) => b[1] - a[1]);
    const topH = sortedByErrors[0];
    console.log(
      `${colors.red}Hypothesis ${topH[0]} has ${topH[1]} error(s)${colors.reset} - ` +
      `likely candidate for root cause.`
    );

    const noErrors = sortedHypotheses.filter(h => !errorsByH[h]);
    if (noErrors.length > 0) {
      console.log(`${colors.green}Hypothesis ${noErrors.join(', ')} show no errors.${colors.reset}`);
    }
  } else if (analysis.total > 0) {
    console.log(`${colors.green}No errors found in any hypothesis.${colors.reset}`);
    console.log('Consider adding more instrumentation or checking for silent failures.');
  } else {
    console.log(`${colors.yellow}No log entries found.${colors.reset}`);
    console.log('Make sure the collector is running and the instrumented code has been executed.');
  }
}

/**
 * Output analysis as JSON
 */
function outputJson(analysis) {
  console.log(JSON.stringify(analysis, null, 2));
}

// Main
const options = parseArgs();
const entries = parseLogFile();
const analysis = analyzeEntries(entries, options.hypothesis);

if (options.json) {
  outputJson(analysis);
} else {
  outputText(analysis);
}
