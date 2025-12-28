# Instrumentation Examples

This document shows before/after examples of how to instrument code for hypothesis-driven debugging.

## Basic Pattern

Add `__debugLog()` calls at strategic points to test your hypotheses.

```javascript
__debugLog(location, hypothesisId, message, data?, level?)
```

Parameters:
- `location` - File and function/line (e.g., `"src/api/orders.ts:processOrder"`)
- `hypothesisId` - Single letter identifying which hypothesis this tests (e.g., `"A"`)
- `message` - Human-readable description of what's happening
- `data` - Optional object with relevant variable values
- `level` - Optional: `"trace"`, `"debug"`, `"info"` (default), `"warn"`, `"error"`

---

## Function Entry/Exit

**Before:**
```javascript
async function processOrder(orderId, items) {
  const validated = validateItems(items);
  const result = await saveOrder(orderId, validated);
  return result;
}
```

**After:**
```javascript
async function processOrder(orderId, items) {
  __debugLog('src/api/orders.ts:processOrder', 'A', 'Function entry', { orderId, itemCount: items?.length });

  const validated = validateItems(items);
  __debugLog('src/api/orders.ts:processOrder', 'A', 'After validation', { validatedCount: validated?.length });

  const result = await saveOrder(orderId, validated);
  __debugLog('src/api/orders.ts:processOrder', 'A', 'Function exit', { success: !!result });

  return result;
}
```

---

## Error Boundaries (try/catch)

**Before:**
```javascript
try {
  const data = JSON.parse(input);
  return processData(data);
} catch (e) {
  return { error: 'Invalid input' };
}
```

**After:**
```javascript
try {
  __debugLog('src/parser.ts:parse', 'B', 'Attempting JSON parse', { inputLength: input?.length });
  const data = JSON.parse(input);
  __debugLog('src/parser.ts:parse', 'B', 'Parse successful', { dataType: typeof data });
  return processData(data);
} catch (e) {
  __debugLog('src/parser.ts:parse', 'B', 'Parse failed', {
    error: e.message,
    inputPreview: input?.slice(0, 100)
  }, 'error');
  return { error: 'Invalid input' };
}
```

---

## Conditional Branches

**Before:**
```javascript
function getDiscount(user, cart) {
  if (user.isPremium) {
    return 0.2;
  } else if (cart.total > 100) {
    return 0.1;
  }
  return 0;
}
```

**After:**
```javascript
function getDiscount(user, cart) {
  __debugLog('src/pricing.ts:getDiscount', 'C', 'Calculating discount', {
    isPremium: user?.isPremium,
    cartTotal: cart?.total
  });

  if (user.isPremium) {
    __debugLog('src/pricing.ts:getDiscount', 'C', 'Premium discount branch', { discount: 0.2 });
    return 0.2;
  } else if (cart.total > 100) {
    __debugLog('src/pricing.ts:getDiscount', 'C', 'High cart discount branch', { discount: 0.1 });
    return 0.1;
  }

  __debugLog('src/pricing.ts:getDiscount', 'C', 'No discount branch', { discount: 0 });
  return 0;
}
```

---

## Async Operations

**Before:**
```javascript
async function fetchUserData(userId) {
  const response = await fetch(`/api/users/${userId}`);
  const data = await response.json();
  return data;
}
```

**After:**
```javascript
async function fetchUserData(userId) {
  __debugLog('src/api/users.ts:fetchUserData', 'D', 'Starting fetch', { userId });

  const response = await fetch(`/api/users/${userId}`);
  __debugLog('src/api/users.ts:fetchUserData', 'D', 'Response received', {
    status: response.status,
    ok: response.ok
  });

  if (!response.ok) {
    __debugLog('src/api/users.ts:fetchUserData', 'D', 'Fetch failed', {
      status: response.status
    }, 'error');
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  __debugLog('src/api/users.ts:fetchUserData', 'D', 'Data parsed', {
    hasUser: !!data,
    fields: Object.keys(data || {})
  });

  return data;
}
```

---

## React Components

**Before:**
```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId).then(setUser).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <Spinner />;
  if (!user) return <NotFound />;
  return <Profile user={user} />;
}
```

**After:**
```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  __debugLog('components/UserProfile.tsx:render', 'E', 'Component render', {
    userId,
    hasUser: !!user,
    loading
  });

  useEffect(() => {
    __debugLog('components/UserProfile.tsx:useEffect', 'E', 'Effect triggered', { userId });

    fetchUser(userId)
      .then(data => {
        __debugLog('components/UserProfile.tsx:useEffect', 'E', 'Fetch success', { hasData: !!data });
        setUser(data);
      })
      .catch(e => {
        __debugLog('components/UserProfile.tsx:useEffect', 'E', 'Fetch error', { error: e.message }, 'error');
      })
      .finally(() => {
        __debugLog('components/UserProfile.tsx:useEffect', 'E', 'Fetch complete');
        setLoading(false);
      });
  }, [userId]);

  if (loading) {
    __debugLog('components/UserProfile.tsx:render', 'E', 'Rendering spinner');
    return <Spinner />;
  }
  if (!user) {
    __debugLog('components/UserProfile.tsx:render', 'E', 'Rendering not found', null, 'warn');
    return <NotFound />;
  }
  __debugLog('components/UserProfile.tsx:render', 'E', 'Rendering profile');
  return <Profile user={user} />;
}
```

---

## API Routes (Next.js)

**Before:**
```javascript
export async function POST(request) {
  const body = await request.json();
  const result = await createOrder(body);
  return Response.json(result);
}
```

**After:**
```javascript
export async function POST(request) {
  __debugLog('app/api/orders/route.ts:POST', 'A', 'Request received');

  const body = await request.json();
  __debugLog('app/api/orders/route.ts:POST', 'A', 'Body parsed', {
    hasItems: !!body?.items,
    itemCount: body?.items?.length
  });

  try {
    const result = await createOrder(body);
    __debugLog('app/api/orders/route.ts:POST', 'A', 'Order created', { orderId: result?.id });
    return Response.json(result);
  } catch (e) {
    __debugLog('app/api/orders/route.ts:POST', 'A', 'Order creation failed', {
      error: e.message
    }, 'error');
    return Response.json({ error: e.message }, { status: 500 });
  }
}
```

---

## State Updates

**Before:**
```javascript
function reducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] };
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(i => i.id !== action.payload) };
    default:
      return state;
  }
}
```

**After:**
```javascript
function reducer(state, action) {
  __debugLog('src/store/reducer.ts:reducer', 'A', 'Action received', {
    type: action.type,
    payload: action.payload,
    currentItemCount: state.items?.length
  });

  let newState;
  switch (action.type) {
    case 'ADD_ITEM':
      newState = { ...state, items: [...state.items, action.payload] };
      __debugLog('src/store/reducer.ts:reducer', 'A', 'Item added', { newCount: newState.items.length });
      return newState;

    case 'REMOVE_ITEM':
      newState = { ...state, items: state.items.filter(i => i.id !== action.payload) };
      __debugLog('src/store/reducer.ts:reducer', 'A', 'Item removed', { newCount: newState.items.length });
      return newState;

    default:
      __debugLog('src/store/reducer.ts:reducer', 'A', 'Unknown action', null, 'warn');
      return state;
  }
}
```

---

## Tips

1. **Log variable values, not just messages** - Include the actual data that tests your hypothesis
2. **Use consistent location format** - `file:function` makes logs easy to trace back
3. **Don't log sensitive data** - Never log passwords, tokens, PII, or API keys
4. **Use appropriate levels** - `error` for exceptions, `warn` for unexpected but handled cases
5. **Log before and after** - Especially for async operations, log entry and completion
6. **Keep hypothesis IDs consistent** - One letter per hypothesis, same letter for related logs
