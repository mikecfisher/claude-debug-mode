---
name: debug-fixed
description: User confirms the bug is fixed. Clean up instrumentation and summarize.
---

# Debug Fixed

User confirms the bug is fixed. Clean up and summarize.

## User Notes

$ARGUMENTS

## Workflow

### Step 1: Remove Instrumentation

Remove all `__debugLog()` calls from instrumented files:
- All `__debugLog(...)` calls
- The logger function declaration at the top of each file
- Any imports added for the logger (e.g., `appendFileSync`, `mkdirSync`, `existsSync`)

### Step 2: Stop Collector

```bash
bun ${CLAUDE_PLUGIN_ROOT}/scripts/stop-collector.mjs
```

### Step 3: Summarize

Provide a brief summary:

> **Root Cause:** [Which hypothesis was confirmed and why]
>
> **Fix Applied:** [What change fixed the issue]
>
> **Files Modified:** [List of files that were changed]

## Example Summary

> **Root Cause:** Hypothesis A confirmed - `items` array was `undefined` when `order.items` wasn't provided by the caller, causing "Cannot read property 'length' of undefined"
>
> **Fix Applied:** Added null check with default empty array: `const items = order.items ?? []`
>
> **Files Modified:**
> - `src/api/orders.ts` - Added defensive check in `processOrder()`

## Optional Cleanup

The `.debug/` directory can be left in place (it's gitignored) or removed:
```bash
rm -rf .debug
```
