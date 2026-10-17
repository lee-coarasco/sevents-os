import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { env } from "./env.js";

// ws is compatible at runtime but its types diverge from the WebSocket interface on Node 20
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wsTransport = ws as any;

/**
 * Service-role client for server-side use only. Never expose this client,
 * or the key it holds, to any client-side bundle.
 */
export function createServiceClient(): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false },
    realtime: { transport: wsTransport },
  });
}

/**
 * Client scoped to one request's caller: uses the anon key plus the
 * caller's own bearer token, so Postgrest/Auth calls run as that user and
 * respect RLS instead of the service role bypassing it.
 */
export function createUserScopedClient(accessToken: string): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    realtime: { transport: wsTransport },
  });
}

/** Anon client with no caller identity yet — used only for sign-in itself. */
export function createAnonClient(): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false },
    realtime: { transport: wsTransport },
  });
}
