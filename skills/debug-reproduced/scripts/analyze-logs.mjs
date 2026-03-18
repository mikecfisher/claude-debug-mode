#!/usr/bin/env node

/**
 * Analyze Debug Logs
 *
 * Parses the debug log file and produces a summary grouped by hypothesis.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DEBUG_DIR = join(process.cwd(), ".debug");
const LOG_FILE = join(DEBUG_DIR, "debug.log");

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { json: false, hypothesis: null };

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--json") {
      options.json = true;
    } else if (args[index] === "--hypothesis" || args[index] === "-h") {
      options.hypothesis = args[index + 1] ?? null;
      index += 1;
    }
  }

  return options;
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(1);
  return `${mins}m ${secs}s`;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  const ss = date.getSeconds().toString().padStart(2, "0");
  const ms = date.getMilliseconds().toString().padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function parseLogFile() {
  if (!existsSync(LOG_FILE)) {
    return [];
  }

  const content = readFileSync(LOG_FILE, "utf8");
  const lines = content
    .trim()
    .split("\n")
    .filter((line) => line.trim());
  const entries = [];

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // Skip malformed lines.
    }
  }

  return entries;
}

function analyzeEntries(entries, filterHypothesis) {
  const analysis = {
    errors: [],
    hypotheses: {},
    timeRange: { duration: 0, first: null, last: null },
    total: 0,
  };

  for (const entry of entries) {
    if (filterHypothesis && entry.hypothesisId !== filterHypothesis) {
      continue;
    }

    analysis.total += 1;

    const timestamp = entry.timestamp || Date.now();
    if (!analysis.timeRange.first || timestamp < analysis.timeRange.first) {
      analysis.timeRange.first = timestamp;
    }
    if (!analysis.timeRange.last || timestamp > analysis.timeRange.last) {
      analysis.timeRange.last = timestamp;
    }

    const hypothesisId = entry.hypothesisId;
    if (!analysis.hypotheses[hypothesisId]) {
      analysis.hypotheses[hypothesisId] = {
        count: 0,
        errors: [],
        firstTimestamp: timestamp,
        lastTimestamp: timestamp,
        levels: {},
        locations: {},
      };
    }

    const hypothesis = analysis.hypotheses[hypothesisId];
    hypothesis.count += 1;

    if (timestamp < hypothesis.firstTimestamp) hypothesis.firstTimestamp = timestamp;
    if (timestamp > hypothesis.lastTimestamp) hypothesis.lastTimestamp = timestamp;

    const level = entry.level || "info";
    hypothesis.levels[level] = (hypothesis.levels[level] || 0) + 1;
    hypothesis.locations[entry.location] = (hypothesis.locations[entry.location] || 0) + 1;

    if (level === "error") {
      const errorInfo = {
        data: entry.data,
        location: entry.location,
        message: entry.message,
        timestamp,
      };
      hypothesis.errors.push(errorInfo);
      analysis.errors.push({ ...errorInfo, hypothesisId });
    }
  }

  if (analysis.timeRange.first && analysis.timeRange.last) {
    analysis.timeRange.duration = analysis.timeRange.last - analysis.timeRange.first;
  }

  return analysis;
}

function outputText(analysis) {
  console.log(`${colors.bold}=== Debug Log Analysis ===${colors.reset}`);
  console.log(`Total events: ${analysis.total}`);

  if (analysis.timeRange.first) {
    console.log(
      `Time range: ${formatTime(analysis.timeRange.first)} - ` +
        `${formatTime(analysis.timeRange.last)} ` +
        `(${formatDuration(analysis.timeRange.duration)})`,
    );
  }
  console.log();

  const sortedHypotheses = Object.keys(analysis.hypotheses).sort();

  for (const hypothesisId of sortedHypotheses) {
    const hypothesis = analysis.hypotheses[hypothesisId];

    console.log(
      `${colors.cyan}--- Hypothesis ${hypothesisId} (${hypothesis.count} events) ---${colors.reset}`,
    );

    const levelParts = Object.entries(hypothesis.levels).map(([level, count]) => {
      const color = level === "error" ? colors.red : level === "warn" ? colors.yellow : "";
      return `${color}${count} ${level}${color ? colors.reset : ""}`;
    });
    console.log(`Levels: ${levelParts.join(", ")}`);

    console.log("Locations:");
    const sortedLocations = Object.entries(hypothesis.locations).sort(
      (left, right) => right[1] - left[1],
    );
    for (const [location, count] of sortedLocations) {
      console.log(`  - ${location} (${count} events)`);
    }

    if (hypothesis.errors.length > 0) {
      console.log(`${colors.red}Errors:${colors.reset}`);
      for (const error of hypothesis.errors) {
        console.log(
          `  ${colors.gray}[${formatTime(error.timestamp)}]${colors.reset} ${error.location}`,
        );
        console.log(`    ${colors.red}${error.message}${colors.reset}`);
        if (error.data) {
          const data = typeof error.data === "string" ? error.data : JSON.stringify(error.data);
          console.log(`    ${colors.dim}data: ${data}${colors.reset}`);
        }
      }
    } else {
      console.log(`${colors.green}Errors: None${colors.reset}`);
    }

    console.log();
  }

  console.log(`${colors.bold}=== Summary ===${colors.reset}`);

  if (analysis.errors.length > 0) {
    const errorsByHypothesis = {};
    for (const error of analysis.errors) {
      errorsByHypothesis[error.hypothesisId] = (errorsByHypothesis[error.hypothesisId] || 0) + 1;
    }

    const ranked = Object.entries(errorsByHypothesis).sort((left, right) => right[1] - left[1]);
    for (const [hypothesisId, count] of ranked) {
      console.log(`Hypothesis ${hypothesisId} has ${count} error(s) - likely root cause.`);
    }
  } else if (analysis.total === 0) {
    console.log("No log entries found.");
  } else {
    console.log("No errors found in collected logs.");
  }
}

const options = parseArgs();
const entries = parseLogFile();
const analysis = analyzeEntries(entries, options.hypothesis);

if (options.json) {
  console.log(JSON.stringify(analysis, null, 2));
} else {
  outputText(analysis);
}
