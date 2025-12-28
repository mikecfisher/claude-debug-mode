/**
 * Debug Logger Snippets
 *
 * Copy-paste these snippets into files being instrumented.
 * Choose the appropriate variant based on your environment.
 */

// =============================================================================
// VARIANT 1: Browser/Fetch-based Logger
// Use for: Next.js client components, React apps, browser code
// =============================================================================

const __debugLog_browser = (location, hypothesisId, message, data = null, level = 'info') => {
  const entry = {
    location,
    hypothesisId,
    message,
    data,
    level,
    timestamp: Date.now(),
    sessionId: globalThis.__DEBUG_SESSION_ID__ || 'default',
    runId: globalThis.__DEBUG_RUN_ID__ || null
  };
  fetch('http://127.0.0.1:7777/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry)
  }).catch(() => {}); // Silently fail - don't break the app
};

// =============================================================================
// VARIANT 2: Node.js/Server-side Logger (File-based)
// Use for: Node.js scripts, Next.js API routes, server components
// Requires: import at top of file
// =============================================================================

// Add this import at the top of your file:
// import { appendFileSync, mkdirSync, existsSync } from 'node:fs';

const __debugLog_node = (location, hypothesisId, message, data = null, level = 'info') => {
  const entry = {
    location,
    hypothesisId,
    message,
    data,
    level,
    timestamp: Date.now(),
    sessionId: globalThis.__DEBUG_SESSION_ID__ || 'default',
    runId: globalThis.__DEBUG_RUN_ID__ || null
  };
  try {
    // Inline import for copy-paste convenience
    const fs = await import('node:fs');
    if (!fs.existsSync('.debug')) fs.mkdirSync('.debug', { recursive: true });
    fs.appendFileSync('.debug/debug.log', JSON.stringify(entry) + '\n');
  } catch {}
};

// Synchronous version (no async needed):
const __debugLog_node_sync = (() => {
  const fs = require('node:fs');
  return (location, hypothesisId, message, data = null, level = 'info') => {
    const entry = {
      location,
      hypothesisId,
      message,
      data,
      level,
      timestamp: Date.now(),
      sessionId: globalThis.__DEBUG_SESSION_ID__ || 'default',
      runId: globalThis.__DEBUG_RUN_ID__ || null
    };
    try {
      if (!fs.existsSync('.debug')) fs.mkdirSync('.debug', { recursive: true });
      fs.appendFileSync('.debug/debug.log', JSON.stringify(entry) + '\n');
    } catch {}
  };
})();

// =============================================================================
// VARIANT 3: Hybrid Logger (Auto-detects environment)
// Use for: Universal code that runs in both browser and server
// =============================================================================

const __debugLog = (location, hypothesisId, message, data = null, level = 'info') => {
  const entry = {
    location,
    hypothesisId,
    message,
    data,
    level,
    timestamp: Date.now(),
    sessionId: globalThis.__DEBUG_SESSION_ID__ || 'default',
    runId: globalThis.__DEBUG_RUN_ID__ || null
  };

  if (typeof window !== 'undefined' || typeof fetch === 'function') {
    // Browser or modern Node with fetch
    fetch('http://127.0.0.1:7777/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    }).catch(() => {});
  } else {
    // Node.js without fetch - use file
    import('node:fs').then(({ appendFileSync, mkdirSync, existsSync }) => {
      try {
        if (!existsSync('.debug')) mkdirSync('.debug', { recursive: true });
        appendFileSync('.debug/debug.log', JSON.stringify(entry) + '\n');
      } catch {}
    }).catch(() => {});
  }
};

// =============================================================================
// VARIANT 4: One-liner (Minified)
// Use for: Quick instrumentation, temporary debugging
// Note: Uses fetch, requires collector to be running
// =============================================================================

// One-liner (paste at top of file, use inline):
const __d=(h,m,d,l='info')=>fetch('http://127.0.0.1:7777/ingest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:`${new Error().stack?.split('\\n')[2]?.trim()||'unknown'}`,hypothesisId:h,message:m,data:d,level:l,timestamp:Date.now()})}).catch(()=>{});

// Usage: __d('A', 'Function entry', { arg1, arg2 });
// Usage: __d('B', 'Error caught', { error: e.message }, 'error');

// =============================================================================
// VARIANT 5: TypeScript-friendly version
// Use for: TypeScript files with strict typing
// =============================================================================

/*
interface DebugEntry {
  location: string;
  hypothesisId: string;
  message: string;
  data?: unknown;
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  timestamp?: number;
  sessionId?: string;
  runId?: string;
}

const __debugLog = (
  location: string,
  hypothesisId: string,
  message: string,
  data: unknown = null,
  level: DebugEntry['level'] = 'info'
): void => {
  const entry: DebugEntry = {
    location,
    hypothesisId,
    message,
    data,
    level,
    timestamp: Date.now(),
    sessionId: (globalThis as any).__DEBUG_SESSION_ID__ || 'default',
    runId: (globalThis as any).__DEBUG_RUN_ID__ || null
  };
  fetch('http://127.0.0.1:7777/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry)
  }).catch(() => {});
};
*/

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/*
// Function entry
__debugLog('src/api/orders.ts:processOrder', 'A', 'Function entry', { orderId, items });

// Conditional branch
if (items.length === 0) {
  __debugLog('src/api/orders.ts:processOrder', 'A', 'Empty items branch taken', null, 'debug');
  return { error: 'No items' };
}

// Before async operation
__debugLog('src/api/orders.ts:processOrder', 'B', 'Starting database query', { query });
const result = await db.query(query);
__debugLog('src/api/orders.ts:processOrder', 'B', 'Database query complete', { rowCount: result.length });

// Error handling
try {
  await riskyOperation();
} catch (e) {
  __debugLog('src/api/orders.ts:processOrder', 'A', 'Caught exception', {
    error: e.message,
    stack: e.stack
  }, 'error');
  throw e;
}

// Function exit
__debugLog('src/api/orders.ts:processOrder', 'A', 'Function exit', { result });
return result;
*/

export {
  __debugLog_browser,
  __debugLog_node,
  __debugLog_node_sync,
  __debugLog,
  __d
};
