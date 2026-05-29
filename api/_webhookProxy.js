import { createClient } from "@supabase/supabase-js";

function sendJson(res, status, payload) {
  res.status(status);
  res.setHeader("content-type", "application/json");
  res.send(JSON.stringify(payload));
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") return JSON.parse(req.body);
  return req.body;
}

function getSupabaseEnv() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase URL or anon key on the server");
  }
  return { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey };
}

export async function requireUser(req, res, body, userIdFields = []) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    sendJson(res, 401, { success: false, error: "Missing login token" });
    return null;
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    sendJson(res, 401, { success: false, error: "Invalid login token" });
    return null;
  }

  const bodyUserId = userIdFields.map((field) => body?.[field]).find(Boolean);
  if (bodyUserId && String(bodyUserId) !== data.user.id) {
    sendJson(res, 403, {
      success: false,
      error: "This request does not belong to the logged-in user",
    });
    return null;
  }

  return data.user;
}

export async function forwardToN8n(req, res, { webhookEnvName, userIdFields = [], afterSuccess }) {
  if (req.method !== "POST") {
    sendJson(res, 405, { success: false, error: "Method not allowed" });
    return;
  }

  let body;
  try {
    body = readBody(req);
  } catch {
    sendJson(res, 400, { success: false, error: "Invalid JSON body" });
    return;
  }

  const user = await requireUser(req, res, body, userIdFields);
  if (!user) return;

  const webhookUrl = process.env[webhookEnvName];
  if (!webhookUrl) {
    sendJson(res, 500, { success: false, error: `Missing ${webhookEnvName} on the server` });
    return;
  }

  try {
    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.N8N_WEBHOOK_SECRET
          ? { "x-webhook-secret": process.env.N8N_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // The caller still receives the original upstream body below.
    }

    if (upstream.ok && parsed && afterSuccess) {
      await afterSuccess({ body, parsed: Array.isArray(parsed) ? parsed[0] : parsed, user });
    }

    res.status(upstream.status);
    res.setHeader("content-type", upstream.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (error) {
    sendJson(res, 502, {
      success: false,
      error: error instanceof Error ? error.message : "Webhook request failed",
    });
  }
}

export function serviceClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseEnv();
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY on the server");
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
