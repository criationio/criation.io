import {
  authLogger,
  external_exports
} from "./chunk-I6UHWC54.mjs";
import {
  and,
  db,
  eq,
  isNull,
  metaAdAccounts,
  metaConnections,
  sql
} from "./chunk-6MVDXY4X.mjs";
import {
  __name,
  init_esm
} from "./chunk-KXY2ZOOA.mjs";

// src/lib/db/queries/meta-connections.ts
init_esm();
async function getActiveConnectionByWorkspace(workspaceId) {
  const row = await db.query.metaConnections.findFirst({
    where: and(eq(metaConnections.workspaceId, workspaceId), isNull(metaConnections.deletedAt))
  });
  return row ?? null;
}
__name(getActiveConnectionByWorkspace, "getActiveConnectionByWorkspace");
async function markConnectionExpired(connectionId) {
  await db.update(metaConnections).set({ status: "expired" }).where(eq(metaConnections.id, connectionId));
}
__name(markConnectionExpired, "markConnectionExpired");
async function listAdAccountsByConnection(connectionId) {
  return db.query.metaAdAccounts.findMany({
    where: and(eq(metaAdAccounts.connectionId, connectionId), isNull(metaAdAccounts.deletedAt))
  });
}
__name(listAdAccountsByConnection, "listAdAccountsByConnection");
async function listAllActiveConnections() {
  return db.query.metaConnections.findMany({
    where: and(eq(metaConnections.status, "active"), isNull(metaConnections.deletedAt))
  });
}
__name(listAllActiveConnections, "listAllActiveConnections");
async function listConnectionsNeedingRefresh(thresholdDays = 7) {
  const threshold = new Date(Date.now() + thresholdDays * 24 * 60 * 60 * 1e3);
  return db.query.metaConnections.findMany({
    where: and(
      eq(metaConnections.status, "active"),
      isNull(metaConnections.deletedAt),
      eq(metaConnections.isSystemUserToken, false),
      sql`${metaConnections.tokenExpiresAt} < ${threshold}`
    )
  });
}
__name(listConnectionsNeedingRefresh, "listConnectionsNeedingRefresh");
async function markConnectionSynced(connectionId) {
  await db.update(metaConnections).set({ lastSyncAt: /* @__PURE__ */ new Date() }).where(eq(metaConnections.id, connectionId));
}
__name(markConnectionSynced, "markConnectionSynced");

// src/lib/services/token-refresh.service.ts
init_esm();

// src/lib/encryption.ts
init_esm();
import crypto from "node:crypto";

// src/env.ts
init_esm();

// node_modules/.pnpm/@t3-oss+env-nextjs@0.13.11_typescript@5.9.3_zod@4.4.2/node_modules/@t3-oss/env-nextjs/dist/index.js
init_esm();

// node_modules/.pnpm/@t3-oss+env-core@0.13.11_typescript@5.9.3_zod@4.4.2/node_modules/@t3-oss/env-core/dist/index.js
init_esm();

// node_modules/.pnpm/@t3-oss+env-core@0.13.11_typescript@5.9.3_zod@4.4.2/node_modules/@t3-oss/env-core/dist/standard.js
init_esm();
function ensureSynchronous(value, message) {
  if (value instanceof Promise) throw new Error(message);
}
__name(ensureSynchronous, "ensureSynchronous");
function parseWithDictionary(dictionary, value) {
  const result = {};
  const issues = [];
  for (const key in dictionary) {
    const propResult = dictionary[key]["~standard"].validate(value[key]);
    ensureSynchronous(propResult, `Validation must be synchronous, but ${key} returned a Promise.`);
    if (propResult.issues) {
      issues.push(...propResult.issues.map((issue) => ({
        ...issue,
        message: issue.message,
        path: [key, ...issue.path ?? []]
      })));
      continue;
    }
    result[key] = propResult.value;
  }
  if (issues.length) return { issues };
  return { value: result };
}
__name(parseWithDictionary, "parseWithDictionary");

// node_modules/.pnpm/@t3-oss+env-core@0.13.11_typescript@5.9.3_zod@4.4.2/node_modules/@t3-oss/env-core/dist/index.js
function createEnv(opts) {
  const runtimeEnv = opts.runtimeEnvStrict ?? opts.runtimeEnv ?? process.env;
  if (opts.emptyStringAsUndefined ?? false) {
    for (const [key, value] of Object.entries(runtimeEnv)) if (value === "") delete runtimeEnv[key];
  }
  if (!!opts.skipValidation) {
    if (opts.extends) for (const preset of opts.extends) preset.skipValidation = true;
    return runtimeEnv;
  }
  const _client = typeof opts.client === "object" ? opts.client : {};
  const _server = typeof opts.server === "object" ? opts.server : {};
  const _shared = typeof opts.shared === "object" ? opts.shared : {};
  const isServer = opts.isServer ?? (typeof window === "undefined" || "Deno" in window);
  const finalSchemaShape = isServer ? {
    ..._server,
    ..._shared,
    ..._client
  } : {
    ..._client,
    ..._shared
  };
  const parsed = opts.createFinalSchema?.(finalSchemaShape, isServer)?.["~standard"].validate(runtimeEnv) ?? parseWithDictionary(finalSchemaShape, runtimeEnv);
  ensureSynchronous(parsed, "Validation must be synchronous");
  const onValidationError = opts.onValidationError ?? ((issues) => {
    console.error("❌ Invalid environment variables:", issues);
    throw new Error("Invalid environment variables");
  });
  const onInvalidAccess = opts.onInvalidAccess ?? (() => {
    throw new Error("❌ Attempted to access a server-side environment variable on the client");
  });
  if (parsed.issues) return onValidationError(parsed.issues);
  const isServerAccess = /* @__PURE__ */ __name((prop) => {
    if (!opts.clientPrefix) return true;
    return !prop.startsWith(opts.clientPrefix) && !(prop in _shared);
  }, "isServerAccess");
  const isValidServerAccess = /* @__PURE__ */ __name((prop) => {
    return isServer || !isServerAccess(prop);
  }, "isValidServerAccess");
  const ignoreProp = /* @__PURE__ */ __name((prop) => {
    return prop === "__esModule" || prop === "$$typeof";
  }, "ignoreProp");
  const extendedObj = (opts.extends ?? []).reduce((acc, curr) => {
    return Object.assign(acc, curr);
  }, {});
  const fullObj = Object.assign(extendedObj, parsed.value);
  return new Proxy(fullObj, { get(target, prop) {
    if (typeof prop !== "string") return void 0;
    if (ignoreProp(prop)) return void 0;
    if (!isValidServerAccess(prop)) return onInvalidAccess(prop);
    return Reflect.get(target, prop);
  } });
}
__name(createEnv, "createEnv");

// node_modules/.pnpm/@t3-oss+env-nextjs@0.13.11_typescript@5.9.3_zod@4.4.2/node_modules/@t3-oss/env-nextjs/dist/index.js
var CLIENT_PREFIX = "NEXT_PUBLIC_";
function createEnv2(opts) {
  const client = typeof opts.client === "object" ? opts.client : {};
  const server = typeof opts.server === "object" ? opts.server : {};
  const shared = opts.shared;
  const runtimeEnv = opts.runtimeEnv ? opts.runtimeEnv : {
    ...process.env,
    ...opts.experimental__runtimeEnv
  };
  return createEnv({
    ...opts,
    shared,
    client,
    server,
    clientPrefix: CLIENT_PREFIX,
    runtimeEnv
  });
}
__name(createEnv2, "createEnv");

// node_modules/.pnpm/zod@4.4.2/node_modules/zod/v4/classic/index.js
init_esm();

// src/env.ts
var env = createEnv2({
  server: {
    NODE_ENV: external_exports.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: external_exports.url(),
    SUPABASE_SERVICE_ROLE_KEY: external_exports.string().min(1),
    ENCRYPTION_KEY: external_exports.string().length(64),
    UPSTASH_REDIS_REST_URL: external_exports.url(),
    UPSTASH_REDIS_REST_TOKEN: external_exports.string().min(1),
    HASH_SALT: external_exports.string().min(40),
    ANTHROPIC_API_KEY: external_exports.string().min(1).optional(),
    TRIGGER_SECRET_KEY: external_exports.string().min(1),
    TRIGGER_PROJECT_REF: external_exports.string().min(1),
    TRIGGER_API_URL: external_exports.url().optional(),
    RESEND_API_KEY: external_exports.string().min(1).optional(),
    RESEND_FROM_EMAIL: external_exports.email().optional(),
    SENTRY_AUTH_TOKEN: external_exports.string().min(1).optional(),
    SENTRY_ORG: external_exports.string().min(1).optional(),
    SENTRY_PROJECT: external_exports.string().min(1).optional(),
    BETTERSTACK_SOURCE_TOKEN: external_exports.string().min(1).optional(),
    ASAAS_API_KEY: external_exports.string().min(1).optional(),
    ASAAS_WEBHOOK_SECRET: external_exports.string().min(1).optional(),
    STRIPE_SECRET_KEY: external_exports.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: external_exports.string().min(1).optional(),
    // Meta (Sessao 1.3)
    META_APP_ID: external_exports.string().min(1),
    META_APP_SECRET: external_exports.string().min(1),
    META_GRAPH_VERSION: external_exports.string().default("v25.0")
  },
  client: {
    NEXT_PUBLIC_APP_URL: external_exports.url().optional(),
    NEXT_PUBLIC_APP_DOMAIN: external_exports.string().min(1).optional(),
    NEXT_PUBLIC_ADMIN_DOMAIN: external_exports.string().min(1).optional(),
    NEXT_PUBLIC_SUPABASE_URL: external_exports.url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: external_exports.string().min(1),
    NEXT_PUBLIC_SENTRY_DSN: external_exports.url().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: external_exports.string().min(1).optional(),
    NEXT_PUBLIC_POSTHOG_HOST: external_exports.url().optional(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: external_exports.string().min(1).optional()
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    HASH_SALT: process.env.HASH_SALT,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    TRIGGER_SECRET_KEY: process.env.TRIGGER_SECRET_KEY,
    TRIGGER_PROJECT_REF: process.env.TRIGGER_PROJECT_REF,
    TRIGGER_API_URL: process.env.TRIGGER_API_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    BETTERSTACK_SOURCE_TOKEN: process.env.BETTERSTACK_SOURCE_TOKEN,
    ASAAS_API_KEY: process.env.ASAAS_API_KEY,
    ASAAS_WEBHOOK_SECRET: process.env.ASAAS_WEBHOOK_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    META_APP_ID: process.env.META_APP_ID,
    META_APP_SECRET: process.env.META_APP_SECRET,
    META_GRAPH_VERSION: process.env.META_GRAPH_VERSION,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_DOMAIN: process.env.NEXT_PUBLIC_APP_DOMAIN,
    NEXT_PUBLIC_ADMIN_DOMAIN: process.env.NEXT_PUBLIC_ADMIN_DOMAIN,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true
});

// src/lib/encryption.ts
function getCurrentVersion() {
  return process.env.ENCRYPTION_VERSION ?? "v1";
}
__name(getCurrentVersion, "getCurrentVersion");
function loadKeys() {
  const keys = /* @__PURE__ */ new Map();
  const currentVersion = getCurrentVersion();
  keys.set(currentVersion, {
    version: currentVersion,
    key: Buffer.from(env.ENCRYPTION_KEY, "hex")
  });
  const prevKey = process.env.ENCRYPTION_KEY_V1;
  if (prevKey && prevKey !== env.ENCRYPTION_KEY) {
    const prevVersion = currentVersion === "v1" ? "v0" : "v1";
    keys.set(prevVersion, {
      version: prevVersion,
      key: Buffer.from(prevKey, "hex")
    });
  }
  return keys;
}
__name(loadKeys, "loadKeys");
function encrypt(plaintext) {
  const currentVersion = getCurrentVersion();
  const keys = loadKeys();
  const encKey = keys.get(currentVersion);
  if (!encKey) {
    throw new Error(`Encryption key not found for version: ${currentVersion}`);
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey.key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${currentVersion}:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}
__name(encrypt, "encrypt");
function decrypt(ciphertext) {
  const parts = ciphertext.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid ciphertext format");
  }
  const [version, ivB64, authTagB64, encryptedB64] = parts;
  const keys = loadKeys();
  const encKey = keys.get(version);
  if (!encKey) {
    throw new Error(`Encryption key not found for version: ${version}`);
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encKey.key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
__name(decrypt, "decrypt");

// src/lib/services/meta.service.ts
init_esm();
var GRAPH_BASE = "https://graph.facebook.com";
function graphUrl(path) {
  const v = env.META_GRAPH_VERSION;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${GRAPH_BASE}/${v}${clean}`;
}
__name(graphUrl, "graphUrl");
var metaErrorSchema = external_exports.object({
  error: external_exports.object({
    message: external_exports.string(),
    type: external_exports.string().optional(),
    code: external_exports.number().optional(),
    error_subcode: external_exports.number().optional(),
    fbtrace_id: external_exports.string().optional()
  })
});
var MetaApiError = class extends Error {
  constructor(code, subcode, message, fbtraceId) {
    super(message);
    this.code = code;
    this.subcode = subcode;
    this.fbtraceId = fbtraceId;
    this.name = "MetaApiError";
  }
  static {
    __name(this, "MetaApiError");
  }
};
async function metaFetch(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new MetaApiError(
      void 0,
      void 0,
      `Resposta nao-JSON da Meta API: ${text.slice(0, 200)}`
    );
  }
  if (!res.ok) {
    const parsed2 = metaErrorSchema.safeParse(data);
    if (parsed2.success) {
      const e = parsed2.data.error;
      throw new MetaApiError(e.code, e.error_subcode, e.message, e.fbtrace_id);
    }
    throw new MetaApiError(void 0, void 0, `HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const parsed = init.schema.safeParse(data);
  if (!parsed.success) {
    throw new MetaApiError(
      void 0,
      void 0,
      `Resposta da Meta API nao bate com schema esperado: ${parsed.error.message}`
    );
  }
  return parsed.data;
}
__name(metaFetch, "metaFetch");
var tokenExchangeSchema = external_exports.object({
  access_token: external_exports.string(),
  token_type: external_exports.string().optional(),
  expires_in: external_exports.number().optional()
});
async function extendToLongLivedToken(input) {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    fb_exchange_token: input.shortLivedToken
  });
  const data = await metaFetch(graphUrl(`/oauth/access_token?${params.toString()}`), {
    method: "GET",
    schema: tokenExchangeSchema
  });
  return {
    accessToken: data.access_token,
    expiresInSeconds: data.expires_in ?? null
  };
}
__name(extendToLongLivedToken, "extendToLongLivedToken");
var meSchema = external_exports.object({
  id: external_exports.string(),
  name: external_exports.string().optional(),
  email: external_exports.string().optional()
});
var permissionsSchema = external_exports.object({
  data: external_exports.array(
    external_exports.object({
      permission: external_exports.string(),
      status: external_exports.enum(["granted", "declined", "expired"])
    })
  )
});
var businessesSchema = external_exports.object({
  data: external_exports.array(
    external_exports.object({
      id: external_exports.string(),
      name: external_exports.string(),
      verification_status: external_exports.string().optional()
    })
  )
});
var ownedDomainsSchema = external_exports.object({
  data: external_exports.array(
    external_exports.object({
      id: external_exports.string().optional(),
      name: external_exports.string(),
      is_verified: external_exports.boolean().optional()
    })
  )
});
var adAccountsSchema = external_exports.object({
  data: external_exports.array(
    external_exports.object({
      id: external_exports.string(),
      // 'act_1234'
      account_id: external_exports.string().optional(),
      name: external_exports.string().optional(),
      currency: external_exports.string().optional(),
      timezone_name: external_exports.string().optional(),
      account_status: external_exports.number().optional(),
      business: external_exports.object({
        id: external_exports.string(),
        name: external_exports.string().optional()
      }).optional()
    })
  )
});
var pixelsSchema = external_exports.object({
  data: external_exports.array(
    external_exports.object({
      id: external_exports.string(),
      name: external_exports.string().optional(),
      last_fired_time: external_exports.string().optional()
    })
  )
});
async function fetchAllPages(input) {
  const maxPages = input.maxPages ?? 20;
  const maxItems = input.maxItems ?? 1e3;
  let url = input.initialUrl;
  const items = [];
  let pageCount = 0;
  while (url && pageCount < maxPages && items.length < maxItems) {
    const data = await metaFetch(url, { method: "GET", schema: input.schema });
    items.push(...data.data);
    url = data.paging?.next ?? null;
    pageCount += 1;
  }
  return items.slice(0, maxItems);
}
__name(fetchAllPages, "fetchAllPages");
var campaignSchema = external_exports.object({
  id: external_exports.string(),
  name: external_exports.string(),
  status: external_exports.string(),
  effective_status: external_exports.string().optional(),
  objective: external_exports.string().optional(),
  daily_budget: external_exports.string().optional(),
  lifetime_budget: external_exports.string().optional(),
  start_time: external_exports.string().optional(),
  stop_time: external_exports.string().optional()
});
var campaignsPagedSchema = external_exports.object({
  data: external_exports.array(campaignSchema),
  paging: external_exports.object({
    cursors: external_exports.object({ after: external_exports.string().optional() }).optional(),
    next: external_exports.string().optional()
  }).optional()
});
function metaBudgetToCents(s) {
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}
__name(metaBudgetToCents, "metaBudgetToCents");
async function listCampaigns(input) {
  const accountId = input.adAccountId.startsWith("act_") ? input.adAccountId : `act_${input.adAccountId}`;
  const params = new URLSearchParams({
    access_token: input.accessToken,
    fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time",
    limit: String(input.limit ?? 100)
  });
  const items = await fetchAllPages({
    initialUrl: graphUrl(`/${accountId}/campaigns?${params.toString()}`),
    schema: campaignsPagedSchema,
    maxItems: input.limit ?? 100
  });
  return items.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    effectiveStatus: c.effective_status ?? null,
    objective: c.objective ?? null,
    dailyBudgetCents: metaBudgetToCents(c.daily_budget),
    lifetimeBudgetCents: metaBudgetToCents(c.lifetime_budget),
    startTime: c.start_time ? new Date(c.start_time) : null,
    stopTime: c.stop_time ? new Date(c.stop_time) : null
  }));
}
__name(listCampaigns, "listCampaigns");
var adSetSchema = external_exports.object({
  id: external_exports.string(),
  name: external_exports.string(),
  status: external_exports.string(),
  effective_status: external_exports.string().optional(),
  campaign_id: external_exports.string(),
  targeting: external_exports.unknown().optional()
});
var adSetsPagedSchema = external_exports.object({
  data: external_exports.array(adSetSchema),
  paging: external_exports.object({
    cursors: external_exports.object({ after: external_exports.string().optional() }).optional(),
    next: external_exports.string().optional()
  }).optional()
});
async function listAdSets(input) {
  const params = new URLSearchParams({
    access_token: input.accessToken,
    fields: "id,name,status,effective_status,campaign_id,targeting",
    limit: String(input.limit ?? 100)
  });
  const items = await fetchAllPages({
    initialUrl: graphUrl(`/${input.campaignId}/adsets?${params.toString()}`),
    schema: adSetsPagedSchema,
    maxItems: input.limit ?? 100
  });
  return items.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    effectiveStatus: s.effective_status ?? null,
    campaignId: s.campaign_id,
    targeting: s.targeting ?? null
  }));
}
__name(listAdSets, "listAdSets");
var adSchema = external_exports.object({
  id: external_exports.string(),
  name: external_exports.string(),
  status: external_exports.string(),
  effective_status: external_exports.string().optional(),
  adset_id: external_exports.string(),
  creative: external_exports.object({ id: external_exports.string() }).optional()
});
var adsPagedSchema = external_exports.object({
  data: external_exports.array(adSchema),
  paging: external_exports.object({
    cursors: external_exports.object({ after: external_exports.string().optional() }).optional(),
    next: external_exports.string().optional()
  }).optional()
});
async function listAds(input) {
  const params = new URLSearchParams({
    access_token: input.accessToken,
    fields: "id,name,status,effective_status,adset_id,creative{id}",
    limit: String(input.limit ?? 100)
  });
  const items = await fetchAllPages({
    initialUrl: graphUrl(`/${input.adSetId}/ads?${params.toString()}`),
    schema: adsPagedSchema,
    maxItems: input.limit ?? 100
  });
  return items.map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    effectiveStatus: a.effective_status ?? null,
    adSetId: a.adset_id,
    creativeId: a.creative?.id ?? null
  }));
}
__name(listAds, "listAds");
var insightsActionSchema = external_exports.object({
  action_type: external_exports.string(),
  value: external_exports.string()
});
var insightSchema = external_exports.object({
  ad_id: external_exports.string(),
  date_start: external_exports.string(),
  date_stop: external_exports.string().optional(),
  impressions: external_exports.string().optional(),
  clicks: external_exports.string().optional(),
  spend: external_exports.string().optional(),
  reach: external_exports.string().optional(),
  frequency: external_exports.string().optional(),
  ctr: external_exports.string().optional(),
  cpc: external_exports.string().optional(),
  cpm: external_exports.string().optional(),
  video_play_actions: external_exports.array(insightsActionSchema).optional(),
  video_3_sec_watched_actions: external_exports.array(insightsActionSchema).optional(),
  video_15_sec_watched_actions: external_exports.array(insightsActionSchema).optional(),
  video_30_sec_watched_actions: external_exports.array(insightsActionSchema).optional(),
  actions: external_exports.array(insightsActionSchema).optional()
});
var insightsPagedSchema = external_exports.object({
  data: external_exports.array(insightSchema),
  paging: external_exports.object({
    cursors: external_exports.object({ after: external_exports.string().optional() }).optional(),
    next: external_exports.string().optional()
  }).optional()
});
function pickActionValue(actions, type) {
  if (!actions) return 0;
  const match = actions.find((a) => a.action_type === type);
  return match ? Number.parseFloat(match.value) || 0 : 0;
}
__name(pickActionValue, "pickActionValue");
function dollarsToCents(s) {
  if (!s) return 0;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
__name(dollarsToCents, "dollarsToCents");
function safeDecimal(s) {
  if (!s) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
__name(safeDecimal, "safeDecimal");
async function getAdInsights(input) {
  const accountId = input.adAccountId.startsWith("act_") ? input.adAccountId : `act_${input.adAccountId}`;
  const params = new URLSearchParams({
    access_token: input.accessToken,
    level: "ad",
    date_preset: input.datePreset ?? "last_7d",
    time_increment: "1",
    // por dia
    fields: "ad_id,date_start,date_stop,impressions,clicks,spend,reach,frequency,ctr,cpc,cpm,video_play_actions,video_3_sec_watched_actions,video_15_sec_watched_actions,video_30_sec_watched_actions,actions",
    limit: String(input.limit ?? 500)
  });
  const items = await fetchAllPages({
    initialUrl: graphUrl(`/${accountId}/insights?${params.toString()}`),
    schema: insightsPagedSchema,
    maxItems: input.limit ?? 500,
    maxPages: 30
  });
  return items.map((i) => {
    const impressions = Number.parseInt(i.impressions ?? "0", 10) || 0;
    const video3s = pickActionValue(i.video_3_sec_watched_actions, "video_view");
    const video15s = pickActionValue(i.video_15_sec_watched_actions, "video_view");
    const video30s = pickActionValue(i.video_30_sec_watched_actions, "video_view");
    const videoPlay = pickActionValue(i.video_play_actions, "video_view");
    const ctrRaw = safeDecimal(i.ctr);
    return {
      adId: i.ad_id,
      date: i.date_start,
      impressions,
      clicks: Number.parseInt(i.clicks ?? "0", 10) || 0,
      spendCents: dollarsToCents(i.spend),
      reach: Number.parseInt(i.reach ?? "0", 10) || 0,
      frequency: safeDecimal(i.frequency),
      ctr: ctrRaw !== null ? ctrRaw / 100 : null,
      // Meta retorna em %
      cpcCents: dollarsToCents(i.cpc) || null,
      cpmCents: dollarsToCents(i.cpm) || null,
      videoViews: videoPlay,
      hookRate: video3s > 0 && impressions > 0 ? video3s / impressions : null,
      holdRate15s: video15s > 0 && video3s > 0 ? video15s / video3s : null,
      holdRate30s: video30s > 0 && video3s > 0 ? video30s / video3s : null
    };
  });
}
__name(getAdInsights, "getAdInsights");

// src/lib/services/token-refresh.service.ts
var REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1e3;
var MAX_FAILURES = 3;
async function refreshIfNeeded(connection) {
  if (connection.isSystemUserToken) {
    return { refreshed: false, reason: "system_user_token" };
  }
  if (!connection.tokenExpiresAt) {
    return { refreshed: false, reason: "no_expiry" };
  }
  const msUntilExpiry = new Date(connection.tokenExpiresAt).getTime() - Date.now();
  if (msUntilExpiry > REFRESH_THRESHOLD_MS) {
    return { refreshed: false, reason: "not_needed" };
  }
  let plaintext;
  try {
    plaintext = decrypt(connection.encryptedAccessToken);
  } catch (err) {
    authLogger.error({ err, connectionId: connection.id }, "token decrypt failed");
    await markFailure(connection);
    return { refreshed: false, reason: "failed" };
  }
  try {
    const result = await extendToLongLivedToken({ shortLivedToken: plaintext });
    const newExpiresAt = result.expiresInSeconds ? new Date(Date.now() + result.expiresInSeconds * 1e3) : null;
    await db.update(metaConnections).set({
      encryptedAccessToken: encrypt(result.accessToken),
      tokenExpiresAt: newExpiresAt,
      lastTokenRefreshAt: /* @__PURE__ */ new Date(),
      tokenRefreshFailures: 0,
      status: "active"
    }).where(eq(metaConnections.id, connection.id));
    return { refreshed: true, reason: "success" };
  } catch (err) {
    if (err instanceof MetaApiError) {
      authLogger.warn(
        { code: err.code, subcode: err.subcode, connectionId: connection.id },
        "meta token refresh rejected by api"
      );
    } else {
      authLogger.error({ err, connectionId: connection.id }, "meta token refresh failed");
    }
    const newFailureCount = await markFailure(connection);
    if (newFailureCount >= MAX_FAILURES) {
      await db.update(metaConnections).set({ status: "expired" }).where(eq(metaConnections.id, connection.id));
      return { refreshed: false, reason: "expired", failureCount: newFailureCount };
    }
    return { refreshed: false, reason: "failed", failureCount: newFailureCount };
  }
}
__name(refreshIfNeeded, "refreshIfNeeded");
async function markFailure(connection) {
  const newCount = connection.tokenRefreshFailures + 1;
  await db.update(metaConnections).set({ tokenRefreshFailures: newCount }).where(eq(metaConnections.id, connection.id));
  return newCount;
}
__name(markFailure, "markFailure");

export {
  getActiveConnectionByWorkspace,
  markConnectionExpired,
  listAdAccountsByConnection,
  listAllActiveConnections,
  listConnectionsNeedingRefresh,
  markConnectionSynced,
  decrypt,
  MetaApiError,
  listCampaigns,
  listAdSets,
  listAds,
  getAdInsights,
  refreshIfNeeded
};
//# sourceMappingURL=chunk-HIMGI3ZM.mjs.map
