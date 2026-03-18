---
name: debug-reproduced
description: User confirms the bug was reproduced. Analyze logs and iterate on hypotheses.
---

# Debug Reproduced

User has reproduced the bug. Analyze log evidence and iterate.

## User Notes

$ARGUMENTS

## Workflow

### Step 1: Analyze Logs

Run the analyzer:
```bash
bun ${CLAUDE_PLUGIN_ROOT}/scripts/analyze-logs.mjs
```

Or read raw logs:
```bash
cat .debug/debug.log
```

### Step 2: Evaluate Hypotheses

For each hypothesis, assign one verdict:

- **CONFIRMED**: Log evidence proves this is the cause
- **REJECTED**: Log evidence rules this out
- **INCONCLUSIVE**: Need more instrumentation

**Always cite specific log entries as evidence:**

> Hypothesis A: **CONFIRMED**
> - Log at 14:32:05.123 shows `items` is `undefined` at function entry
> - Log at 14:32:05.156 shows error "Cannot read property 'length' of undefined"
> - Root cause: `order.items` not provided by caller
>
> Hypothesis B: **REJECTED**
> - Logs show `loadUser` completed at 14:32:05.100
> - `renderProfile` started at 14:32:05.200
> - Order is correct, no race condition

### Step 3: Take Action

**If hypothesis CONFIRMED:**
1. Implement the fix
2. **Keep instrumentation in place** (do NOT remove logs yet)
3. Provide new reproduction steps to verify fix
4. After user reproduces, **compare before/after logs** — cite specific entries showing the fix worked

**If INCONCLUSIVE:**
1. Add more instrumentation to narrow down
2. Provide new reproduction steps

**If ALL hypotheses REJECTED:**
1. Generate NEW hypotheses from **different subsystems**
2. Add instrumentation for new hypotheses
3. Provide new reproduction steps

### Step 4: Next Iteration

Provide exact reproduction steps:

<reproduction_steps>
1. [Step 1]
2. [Step 2]
...
</reproduction_steps>

End with:
> Follow these steps, then run `/debug-reproduced` when done, or `/debug-fixed` if the issue is resolved.

## Critical Rules

1. **NEVER fix without 100% confidence with log proof**
2. **NEVER remove instrumentation before verified fix**
3. **ALWAYS cite specific log entries** — "Log at 14:32:05 shows X was null"
4. **Iteration is expected** — Failed fixes mean new hypotheses, not giving up
5. **3 failed fixes = step back** — Reconsider assumptions, look at different subsystems
6. **Taking longer is better** — Thorough debugging beats quick guesses

## Note on Log Accumulation

Logs accumulate across iterations (not auto-cleared). This allows comparing behavior across reproduction cycles. Run `bun ${CLAUDE_PLUGIN_ROOT}/scripts/clear-logs.mjs` if you need a fresh start.
