const { makeHttpRequest } = require('./http-client.js');
const { z } = require('zod');
const { randomUUID } = require('crypto');

const inflight = new Set(); // holds unique UUIDs
const inflightPerPath = new Map();

function wildcardToRegExp(pattern) {
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, function(match) {
    return '\\' + match;
  }).replace(/\*/g, '.*');
  return new RegExp('^' + esc + '$');
}

function checkRateLimit() {
    // CONFIG - re-evaluate on each call
    const RATE_LIMIT = Number(process.env.OPENAPI_MCP_RATE_LIMIT || 0);
    if (RATE_LIMIT <= 0) return; // No rate limiting applied

    const RATE_BURST = Number(process.env.OPENAPI_MCP_RATE_BURST || RATE_LIMIT || 0);
    const RATE_WINDOW_MS = Number(process.env.OPENAPI_MCP_RATE_WINDOW_MS || 60000);
    const now = Date.now();

    // STATE - stored on function object to persist
    // Initialize state on first run, or if burst rate changes, effectively resetting the limiter
    if (checkRateLimit.tokens === undefined || checkRateLimit.lastBurst !== RATE_BURST) {
        checkRateLimit.tokens = RATE_BURST;
        checkRateLimit.lastBurst = RATE_BURST;
        checkRateLimit.lastRefill = now;
    }

    // REFILL tokens based on elapsed time
    const elapsed = now - checkRateLimit.lastRefill;
    if (elapsed > 0) {
        const ratePerMs = RATE_LIMIT / RATE_WINDOW_MS;
        checkRateLimit.tokens = Math.min(RATE_BURST, checkRateLimit.tokens + elapsed * ratePerMs);
        checkRateLimit.lastRefill = now;
    }

    // CONSUME a token
    if (checkRateLimit.tokens < 1) {
        throw new Error('Rate limit exceeded');
    }
    checkRateLimit.tokens -= 1;
}

function enforcePolicy(method, path) {
  const ALLOWED_METHODS = new Set(
    String(process.env.OPENAPI_MCP_ALLOWED_METHODS || 'GET,POST,PUT,PATCH,DELETE')
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean)
  );
  const ALLOWED_PATH_PATTERNS = (process.env.OPENAPI_MCP_ALLOWED_PATHS || '').split(',').map(p => p.trim()).filter(Boolean);
  const ALLOWED_PATH_REGEXES = ALLOWED_PATH_PATTERNS.map(wildcardToRegExp);

  const m = String(method || '').toUpperCase();
  if (!ALLOWED_METHODS.has(m)) throw new Error(`Method not allowed: ${m}`);
  const p = String(path || '');
  const ok = ALLOWED_PATH_REGEXES.length === 0 || ALLOWED_PATH_REGEXES.some(re => re.test(p));
  if (!ok) throw new Error(`Path not allowed: ${p}`);
}

// Return a unique marker so we can release the exact one we acquired
function acquireConcurrency(path) {
  const GLOBAL_CONCURRENCY = Number(process.env.OPENAPI_MCP_CONCURRENCY || 0);
  const PER_PATH_CONCURRENCY = Number(process.env.OPENAPI_MCP_CONCURRENCY_PER_PATH || 0);

  if (GLOBAL_CONCURRENCY > 0 && inflight.size >= GLOBAL_CONCURRENCY) {
    throw new Error('Concurrency limit exceeded');
  }
  if (PER_PATH_CONCURRENCY > 0) {
    const n = inflightPerPath.get(path) || 0;
    if (n >= PER_PATH_CONCURRENCY) throw new Error('Per-path concurrency limit exceeded');
    inflightPerPath.set(path, n + 1);
  }
  const id = randomUUID();   // ✅ stable UUID instead of Symbol
  inflight.add(id);
  return id;
}

function releaseConcurrency(path, id) {
  if (id && inflight.has(id)) {
    inflight.delete(id);
  } else {
    // Fallback cleanup
    for (const k of inflight) {
      inflight.delete(k);
      break;
    }
  }
  if (PER_PATH_CONCURRENCY > 0) {
    const n = inflightPerPath.get(path) || 1;
    inflightPerPath.set(path, Math.max(0, n - 1));
  }
}

function jsonSchemaToZod(schema) {
  const typeMap = {
    string: z.string,
    number: z.number,
    integer: z.number,
    boolean: z.boolean,
    object: z.object,
    array: z.array,
  };

  if (!schema || (!schema.type && !schema.anyOf && !schema.oneOf)) {
    return z.any();
  }

  // Unions
  if (schema.anyOf) {
    return z.union(schema.anyOf.map(jsonSchemaToZod));
  }
  if (schema.oneOf) {
    return z.union(schema.oneOf.map(jsonSchemaToZod));
  }

  const zodType = typeMap[schema.type];
  if (!zodType) return z.any();

  if (schema.type === 'object') {
    const shape = {};
    const required = Array.isArray(schema.required) ? new Set(schema.required) : new Set();
    if (schema.properties) {
      for (const key in schema.properties) {
        let prop = jsonSchemaToZod(schema.properties[key]);
        if (!required.has(key)) prop = prop.optional();
        shape[key] = prop;
      }
    }
    return zodType(shape);
  }

  if (schema.type === 'array') {
    if (schema.items) {
      return zodType(jsonSchemaToZod(schema.items));
    }
    return zodType(z.any());
  }

  let zodSchema = zodType();

  if (schema.description) {
    zodSchema = zodSchema.describe(schema.description);
  }
  if (schema.minLength != null) {
    zodSchema = zodSchema.min(schema.minLength);
  }
  if (schema.maxLength != null) {
    zodSchema = zodSchema.max(schema.maxLength);
  }
  if (schema.minimum != null) {
    zodSchema = zodSchema.gte(schema.minimum);
  }
  if (schema.maximum != null) {
    zodSchema = zodSchema.lte(schema.maximum);
  }
  if (schema.enum) {
    if (schema.enum.every(v => typeof v === 'string')) zodSchema = z.enum(schema.enum);
    else zodSchema = z.union(schema.enum.map(v => z.literal(v)));
  }

  return zodSchema;
}

// Simple in-memory OAuth2 token cache
const __oauth2Cache = new Map(); // key: tokenUrl|clientId|scopes -> { token, exp }

async function genericHandler(serializationInfo, args) {
  const {
    path,
    method,
    pathParams = [],
    queryParams = [],
    headerParams = [],
    cookieParams = [],
    security = [],
    inputSchema
  } = serializationInfo;

  // Validate input arguments
  if (inputSchema) {
    const zodSchema = jsonSchemaToZod(inputSchema);
    const validationResult = zodSchema.safeParse(args);
    if (!validationResult.success) {
      throw new Error(`Invalid input: ${validationResult.error.message}`);
    }
  }

  const resolvedBaseUrl = process.env.OPENAPI_BASE_URL || '<%= openApiBaseUrl %>';
  let resolvedPath = path;
  const requestQuery = {};
  const requestHeaders = {};
  const requestCookies = {};
  let requestBody;

  const securityHandlers = {
    apiKey: (sec, headers, query, args) => {
      const key = sec.paramName || sec.name; // prefer actual header/query name
      if (!key) return;
      if (sec.in === 'header') {
        headers[key] = args[key];
      } else if (sec.in === 'query') {
        query[key] = args[key];
      } else if (sec.in === 'cookie') {
        headers['Cookie'] = `${key}=${encodeURIComponent(String(args[key] || ''))}`;
      }
    },
    http: (sec, headers, _query, args) => {
      if (sec.scheme === 'bearer') {
        headers['Authorization'] = `Bearer ${args.bearerToken}`;
      } else if (sec.scheme === 'basic') {
        const token = Buffer.from(`${args.username}:${args.password}`).toString('base64');
        headers['Authorization'] = `Basic ${token}`;
      }
    },
    oauth2: async (sec, headers, _query, args) => {
      if (sec.flows && sec.flows.clientCredentials) {
        const tokenUrl = sec.flows.clientCredentials.tokenUrl;
        const scopes = Array.isArray(sec.flows.clientCredentials.scopes)
          ? sec.flows.clientCredentials.scopes.join(' ')
          : '';
        const cacheKey = `${tokenUrl}|${args.clientId || ''}|${scopes}`;
        const now = Date.now();
        const cached = __oauth2Cache.get(cacheKey);
        if (cached && cached.exp > now + 5000) {
          headers['Authorization'] = `Bearer ${cached.token}`;
          return;
        }
        const DEBUG_HTTP = /^(1|true|yes)$/i.test(String(process.env.DEBUG_HTTP || ''));
        const body =
          `grant_type=client_credentials` +
          `&client_id=${encodeURIComponent(args.clientId || '')}` +
          `&client_secret=${encodeURIComponent(args.clientSecret || '')}` +
          (scopes ? `&scope=${encodeURIComponent(scopes)}` : '');
        const attempt = async () =>
          makeHttpRequest('POST', tokenUrl, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, timeoutMs: 10000 });
        let tokenResponse, tries = 0; let lastErr;
        while (tries < 3) {
          try { tokenResponse = await attempt(); break; }
          catch (e) { lastErr = e; tries++; await new Promise(r => setTimeout(r, 200 * tries)); }
        }
        if (!tokenResponse) throw new Error(`Failed to get OAuth2 token: ${lastErr?.message || 'unknown error'}`);
        if (DEBUG_HTTP) console.log(`OAuth2 Token Response Status: ${tokenResponse.statusCode}`);
        if (tokenResponse.statusCode >= 400) throw new Error(`Failed to get OAuth2 token: ${tokenResponse.body}`);
        const token = JSON.parse(tokenResponse.body || '{}');
        if (!token.access_token) throw new Error('OAuth2 token response missing access_token');
        const exp = now + Math.max(0, Number(token.expires_in || 0)) * 1000;
        __oauth2Cache.set(cacheKey, { token: token.access_token, exp });
        headers['Authorization'] = `Bearer ${token.access_token}`;
      }
    }
  };

  for (const sec of security) {
    if (securityHandlers[sec.type]) {
      await securityHandlers[sec.type](sec, requestHeaders, requestQuery, args);
    }
  }

  for (const paramName of pathParams) {
    if (args[paramName] === undefined) throw new Error(`Missing required path parameter: ${paramName}`);
    resolvedPath = resolvedPath.replace(`{${paramName}}`, encodeURIComponent(String(args[paramName])));
  }

  for (const paramName of queryParams) {
    if (args[paramName] !== undefined) requestQuery[paramName] = args[paramName];
  }

  for (const paramName of headerParams) {
    if (args[paramName] !== undefined) requestHeaders[paramName] = args[paramName];
  }

  for (const paramName of cookieParams) {
    if (args[paramName] !== undefined) requestCookies[paramName] = args[paramName];
  }

  if (Object.keys(requestCookies).length > 0) {
    const cookiePieces = Object.entries(requestCookies).map(([k, v]) => `${k}=${v}`);
    requestHeaders['Cookie'] = [requestHeaders['Cookie'], cookiePieces.join('; ')].filter(Boolean).join('; ');
  }

  if (args.body !== undefined) {
    requestBody = args.body;
    // Auto-JSON encode if it's a plain object and no content-type provided
    const hasCT = Object.keys(requestHeaders).some(h => h.toLowerCase() === 'content-type');
    if (!hasCT && (typeof requestBody === 'object' && requestBody !== null)) {
      requestHeaders['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(requestBody);
    }
  }

  const url = new URL(resolvedBaseUrl);
  // Preserve any base path from OPENAPI_BASE_URL while replacing just the path component.
  url.pathname = resolvedPath;

  // Append query params; support arrays
  Object.keys(requestQuery).forEach(key => {
    const val = requestQuery[key];
    if (Array.isArray(val)) {
      val.forEach(v => url.searchParams.append(key, v));
    } else if (val !== undefined && val !== null) {
      url.searchParams.append(key, String(val));
    }
  });

  enforcePolicy(method, resolvedPath);
  checkRateLimit();
  const marker = acquireConcurrency(resolvedPath);

  try {
    const response = await makeHttpRequest(
      String(method || 'GET').toUpperCase(),
      url.toString(),
      { headers: requestHeaders, body: requestBody, timeoutMs: 30000 }
    );

    if (response.statusCode >= 400) {
      let msg = `API Error: ${response.statusCode} ${response.statusMessage}`;
      try {
        msg += ` - ${JSON.stringify(JSON.parse(response.body))}`;
      } catch (_) {
        msg += ` - ${response.body}`;
      }
      throw new Error(msg);
    }

    try {
      return JSON.parse(response.body);
    } catch (_) {
      return response.body;
    }
  } finally {
    releaseConcurrency(resolvedPath, marker);
  }
}

const tools = [
  <%= tools %>
];

module.exports = {
  tools,
  genericHandler, // export if you need to call it directly elsewhere
};