---
name: debug-mode
description: Hypothesis-driven debugging with runtime log instrumentation. Use when user reports a bug, unexpected behavior, flaky test, or when runtime evidence is needed to understand code behavior. Invoke for issues like "X isn't working", "I'm seeing Y error", "why does Z happen", or when multiple code paths could cause the problem.
---

# Debug Mode

You are now in **DEBUG MODE**. You debug with **runtime evidence**, not guesses.

## Why This Approach

Traditional AI debugging fails because agents guess at fixes based on static code analysis. They claim confidence but lack runtime data. This leads to multiple failed fix attempts.

**You cannot fix bugs by reading code alone.** You need actual runtime data showing:
- What values variables hold at specific moments
- Which code paths execute
- What order events occur in
- What errors are thrown and where

**Expect iteration.** Fixes often fail on the first try—this is normal. Each failed attempt provides new data that narrows down the root cause. Taking longer with more evidence yields precise fixes. Never give up after one failed fix; generate new hypotheses from different subsystems.

## Initial Response

When user invokes `/debug-mode`:

1. Start the log collector (silently):
   ```bash
   curl -s http://127.0.0.1:7777/health || bun ${CLAUDE_PLUGIN_ROOT}/scripts/start-collector.mjs
   ```

2. Check if user provided a bug description via arguments:

**If `$ARGUMENTS` is provided** (e.g., `/debug-mode color picker doesn't save changes`):
- Use the provided description as the bug report
- Proceed directly to generating hypotheses (Step 1 below)

**If no arguments provided** (just `/debug-mode`):
- Respond with:
  > I'll help you debug. Please describe your issue and include:
  > - Expected behavior vs actual behavior
  > - How to reproduce the bug
  > - Any error messages or symptoms
  > - Relevant files (use @file or paste code)

## Bug Description

$ARGUMENTS

## After User Describes Issue (or if $ARGUMENTS was provided)

### Step 1: Generate Hypotheses

Generate **3-5 precise hypotheses** about WHY the bug occurs. Be specific and testable.

| ID | Hypothesis |
|----|------------|
| A | `items` array is undefined when `order.items` isn't provided |
| B | Race condition: `loadUser` completes after `renderProfile` |
| C | Stale closure captures old `count` value in callback |
| D | API returns 200 but empty body on timeout |
| E | Cache returns stale data after invalidation |

**Bad:** "Something is wrong with the data"
**Good:** "The `userId` is null when accessed before auth completes"

### Step 2: Instrument Code

Add logging to test **ALL hypotheses in parallel**. Insert `__debugLog()` calls at:
- Function entry/exit with relevant args and return values
- Conditional branch points (which path was taken?)
- Before/after async operations (timing and order)
- Error catch blocks (what was caught?)
- State changes (before/after values)

**Add this logger to the top of each instrumented file:**

```javascript
const __debugLog = (loc, hyp, msg, data = null, lvl = 'info') => {
  fetch('http://127.0.0.1:7777/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: loc, hypothesisId: hyp, message: msg, data, level: lvl, timestamp: Date.now() })
  }).catch(() => {});
};
```

**CRITICAL: Always use the fetch-based logger above.** It works in both browser AND server environments because the collector server accepts HTTP requests. NEVER use `node:fs` imports in client-side code - this will crash the browser.

**Log call format:**
```javascript
__debugLog('src/api/orders.ts:processOrder', 'A', 'Function entry', { orderId, itemCount: items?.length });
```

Parameters:
- `location`: `"file:function"` for traceability
- `hypothesisId`: Single letter (`A`, `B`, `C`, etc.) linking to your hypothesis
- `message`: What's happening at this point
- `data`: Variables that would confirm/reject the hypothesis
- `level`: `'info'` (default), `'error'`, `'warn'`, `'debug'`

### Step 3: Provide Reproduction Steps

**CRITICAL: You MUST provide specific, numbered step-by-step instructions tailored to the user's bug.** Do not give vague instructions. Base the steps on what the user told you about their issue.

Clear previous logs:
```bash
bun ${CLAUDE_PLUGIN_ROOT}/scripts/clear-logs.mjs
```

Provide **exact, specific steps** the user should follow. Use this format:

<reproduction_steps>
1. [Specific action based on user's bug report]
2. [Next specific action]
3. [Action that triggers the bug]
4. [What to observe]
</reproduction_steps>

**Example** (for an order submission bug):
<reproduction_steps>
1. Open http://localhost:3000 in your browser
2. Navigate to the Orders page
3. Click "Create New Order"
4. Leave the cart empty and click Submit
5. Observe the error message
</reproduction_steps>

**DO NOT do this:**
```
Follow these steps to reproduce the bug, then run /debug-reproduced...
```
This is WRONG — you said "follow these steps" but provided no steps! The user has no idea what to do.

**Before finishing Step 3, verify:**
- [ ] You included actual numbered steps inside `<reproduction_steps>` tags
- [ ] Steps are specific to THIS bug (not generic placeholders)
- [ ] You reminded user to restart server if you changed backend code

End with:
> Follow these steps to reproduce the bug, then run `/debug-reproduced` when done, or `/debug-fixed` if the issue is already resolved.

## Instrumentation Patterns

### Function Entry/Exit
```javascript
function processOrder(orderId, items) {
  __debugLog('orders.ts:processOrder', 'A', 'Entry', { orderId, itemCount: items?.length });
  // ... function body ...
  __debugLog('orders.ts:processOrder', 'A', 'Exit', { result });
  return result;
}
```

### Try/Catch
```javascript
try {
  __debugLog('file:func', 'A', 'Trying operation', { input });
  result = riskyOp();
  __debugLog('file:func', 'A', 'Operation succeeded', { result });
} catch (e) {
  __debugLog('file:func', 'A', 'Caught error', { error: e.message, stack: e.stack }, 'error');
  throw e;
}
```

### Conditional Branches
```javascript
if (user.isAdmin) {
  __debugLog('auth.ts:checkPermission', 'B', 'Admin path', { userId: user.id });
} else {
  __debugLog('auth.ts:checkPermission', 'B', 'Regular user path', { userId: user.id });
}
```

### Async Operations
```javascript
__debugLog('api.ts:fetchUser', 'C', 'Starting fetch', { userId });
const user = await fetchUser(userId);
__debugLog('api.ts:fetchUser', 'C', 'Fetch complete', { hasUser: !!user, userName: user?.name });
```

## Critical Rules

1. **NEVER fix without runtime evidence** — Hypotheses must be confirmed by logs
2. **ALWAYS use hypothesis IDs** — Every log call needs its letter (A, B, C...)
3. **NEVER log sensitive data** — No passwords, tokens, PII, API keys
4. **More instrumentation > guessing** — When in doubt, add more logs
