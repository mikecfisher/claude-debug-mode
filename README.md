# Debug Mode for Claude Code

This tool recreates Debug Mode found in other popular agentic code editors.

Debug Mode forces a disciplined debugging process:

1. **Hypothesize** - Generate multiple specific theories about the bug's cause
2. **Start Logging Server** - Spins up a lightweight server to collect logs based on each hypothesis
3. **Instrument** - Add targeted logging to test each hypothesis
4. **Reproduce** - You trigger the bug while logs capture what actually happens
5. **Analyze** - Confirm or reject hypotheses based on runtime evidence
6. **Fix** - Implement the fix with confidence
7. **Verify** - Prove the fix works with fresh logs

## Installation

### Option 1: From Plugin Marketplace

In Claude Code interactive mode:
```
/plugin install debug-mode@mikecfisher-claude-debug-mode
```

Or via CLI:
```bash
claude plugin install debug-mode@mikecfisher-claude-debug-mode
```

### Option 2: Local Development

```bash
git clone https://github.com/mikecfisher/claude-debug-mode.git
claude --plugin-dir ./claude-debug-mode
```

You can also load multiple plugins:
```bash
claude --plugin-dir ./claude-debug-mode --plugin-dir ./other-plugin
```

## Usage

### Workflow

1. **Start debugging** — Describe your bug:
   ```
   /debug-mode The checkout button isn't working
   ```

2. **Reproduce** — Follow Claude's reproduction steps to trigger the bug

3. **Report result** — Run one of:
   - `/debug-reproduced` — Bug still happening (Claude analyzes logs, iterates)
   - `/debug-fixed` — Bug is fixed (Claude cleans up instrumentation)

## How It Works

### 1. `/debug-mode` — Claude generates hypotheses and instruments code

When you report a bug, Claude creates specific, testable theories:

| ID | Hypothesis |
|----|------------|
| A | `items` array is undefined when `order.items` isn't provided |
| B | Race condition: `loadUser` completes after `renderProfile` |
| C | API returns 200 but empty body on timeout |

Then instruments your code with logging:

```javascript
// Before
async function processOrder(orderId, items) {
  const validated = validateItems(items);
  return await saveOrder(orderId, validated);
}

// After (instrumented)
async function processOrder(orderId, items) {
  __debugLog('orders.ts:processOrder', 'A', 'Entry', { orderId, itemCount: items?.length });

  const validated = validateItems(items);
  __debugLog('orders.ts:processOrder', 'A', 'After validation', { validated: !!validated });

  return await saveOrder(orderId, validated);
}
```

### 2. You reproduce the bug

Follow Claude's reproduction steps. Logs capture exactly what happens at runtime.

### 3. `/debug-reproduced` — Claude analyzes and iterates

```
=== Debug Log Analysis ===
Total events: 12
Time range: 14:32:05.123 - 14:32:05.891

--- Hypothesis A (8 events) ---
Errors:
  [14:32:05.156] orders.ts:processOrder
    Cannot read property 'length' of undefined

--- Hypothesis B (4 events) ---
Errors: None

=== Summary ===
Hypothesis A has 1 error - likely root cause.
```

Claude implements a fix (keeping instrumentation), then asks you to reproduce again. This cycle continues until the bug is fixed.

### 4. `/debug-fixed` — Clean up

Claude removes all instrumentation and provides a summary of the root cause and fix.

## Requirements

- **Claude Code**
- **Node.js** 18+ or **Bun**

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG_PORT` | `7777` | Port for the log collector server |

```bash
DEBUG_PORT=8080 claude --plugin-dir ./claude-debug-mode
```

## How Logs Are Collected

Debug Mode runs a lightweight HTTP server on localhost that collects log entries. Logs are written to `.debug/debug.log` in your project directory.

- **Browser code**: Logs via `fetch()` to the collector
- **Server code**: Logs directly to the file system
- **Logs are local**: Nothing leaves your machine

Add `.debug/` to your `.gitignore` to avoid committing debug logs.

## License

MIT

## Contributing

Issues and PRs welcome at [github.com/mikecfisher/claude-debug-mode](https://github.com/mikecfisher/claude-debug-mode).
