import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppUser, AuditEventType, AuditLogEntry } from "./types.js";

/**
 * Everything the identity service needs, kept free of Supabase-specific
 * call shapes so business logic (service.ts) can be unit-tested with a
 * plain in-memory fake instead of mocking a Postgrest query chain.
 */
export interface IdentityRepository {
  findAppUserByEmail(email: string): Promise<AppUser | null>;
  getAppUserById(userId: string): Promise<AppUser | null>;
  insertAppUser(user: {
    id: string;
    email: string;
    display_name: string | null;
    invited_by: string | null;
  }): Promise<AppUser>;
  /** Returns null if the user wasn't in "pending" status (idempotent no-op upstream). */
  activateAppUser(userId: string): Promise<AppUser | null>;
  deactivateAppUser(userId: string): Promise<AppUser>;
  /** Scrubs email/display_name and forces deactivated status; keeps the row (and every FK into it) intact. See DECISIONS.md 2026-10-16 (ticket 0080) for why this is anonymize-in-place, not a hard delete. */
  anonymizeAppUser(userId: string): Promise<AppUser>;
  insertAuditEvent(
    userId: string | null,
    eventType: AuditEventType,
    metadata: Record<string, unknown>,
  ): Promise<void>;
  inviteAuthUser(email: string): Promise<{ id: string }>;
  /** Blocks future sign-in without deleting the auth.users row. */
  banAuthUser(userId: string): Promise<void>;
  getUserIdFromAccessToken(accessToken: string): Promise<string | null>;
  /**
   * Ticket 0108: backs the shared `<UserPicker>` — every tenant member,
   * for picking an assignee/reviewer/approver. Queried through the
   * user-scoped client (not service role) so the
   * `app_users_select_same_tenant` RLS policy enforces tenant isolation
   * independently of this handler, same convention as `listOwnAuditLog`.
   */
  listUsers(accessToken: string): Promise<AppUser[]>;
  signInWithPassword(
    email: string,
    password: string,
  ): Promise<
    | { ok: true; userId: string; accessToken: string; refreshToken: string }
    | { ok: false; message: string }
  >;
  /** Revokes the session server-side (does not delete the account). */
  signOut(accessToken: string): Promise<void>;
  listOwnAuditLog(accessToken: string, userId: string): Promise<AuditLogEntry[]>;
  enrollMfa(accessToken: string): Promise<{ factorId: string; raw: unknown }>;
  verifyMfa(
    accessToken: string,
    params: { factorId: string; challengeId: string; code: string },
  ): Promise<{ ok: boolean; message?: string; raw?: unknown }>;
}

/**
 * Supabase-backed implementation. Not unit-tested directly in this
 * ticket — this sandbox has no reachable SUPABASE_URL/SUPABASE_*_KEY, so
 * there's no live project to exercise it against. service.test.ts covers
 * all business logic through the interface above instead. Confirm this
 * adapter against the real project (GET /identity/* smoke test) once
 * real credentials are available, same gap already flagged in ticket
 * 0053 for GET /health.
 */
export function createSupabaseIdentityRepository(
  serviceClient: SupabaseClient,
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
  anonClientFactory: () => SupabaseClient,
): IdentityRepository {
  return {
    async findAppUserByEmail(email) {
      const { data, error } = await serviceClient
        .from("app_users")
        .select("*")
        .ilike("email", email)
        .maybeSingle();
      if (error) throw new Error(`findAppUserByEmail: ${error.message}`);
      return (data as AppUser | null) ?? null;
    },

    async getAppUserById(userId) {
      const { data, error } = await serviceClient
        .from("app_users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw new Error(`getAppUserById: ${error.message}`);
      return (data as AppUser | null) ?? null;
    },

    async insertAppUser(user) {
      const { data, error } = await serviceClient
        .from("app_users")
        .insert({ ...user, status: "pending" })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`insertAppUser: ${error?.message ?? "no row returned"}`);
      }
      return data as AppUser;
    },

    async activateAppUser(userId) {
      const { data, error } = await serviceClient
        .from("app_users")
        .update({ status: "active", activated_at: new Date().toISOString() })
        .eq("id", userId)
        .eq("status", "pending")
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`activateAppUser: ${error.message}`);
      return (data as AppUser | null) ?? null;
    },

    async deactivateAppUser(userId) {
      const { data, error } = await serviceClient
        .from("app_users")
        .update({ status: "deactivated", deactivated_at: new Date().toISOString() })
        .eq("id", userId)
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`deactivateAppUser: ${error?.message ?? "user not found"}`);
      }
      return data as AppUser;
    },

    async anonymizeAppUser(userId) {
      const { data, error } = await serviceClient
        .from("app_users")
        .update({
          email: `deleted-${userId}@anonymized.invalid`,
          display_name: null,
          status: "deactivated",
          deactivated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`anonymizeAppUser: ${error?.message ?? "user not found"}`);
      }
      return data as AppUser;
    },

    async insertAuditEvent(userId, eventType, metadata) {
      const { error } = await serviceClient.from("auth_audit_log").insert({
        user_id: userId,
        event_type: eventType,
        metadata,
      });
      if (error) throw new Error(`insertAuditEvent: ${error.message}`);
    },

    async inviteAuthUser(email) {
      const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email);
      if (error || !data?.user) {
        throw new Error(`inviteAuthUser: ${error?.message ?? "no user returned"}`);
      }
      return { id: data.user.id };
    },

    async banAuthUser(userId) {
      // Supabase has no "permanent" ban, only a duration; ~100 years
      // blocks sign-in for all practical purposes without deleting the
      // auth.users row (BRD 6.1: never silently delete audit-relevant records).
      const { error } = await serviceClient.auth.admin.updateUserById(userId, {
        ban_duration: "876000h",
      });
      if (error) throw new Error(`banAuthUser: ${error.message}`);
    },

    async getUserIdFromAccessToken(accessToken) {
      const userClient = userScopedClientFactory(accessToken);
      const { data, error } = await userClient.auth.getUser();
      if (error || !data?.user) return null;
      return data.user.id;
    },

    async signInWithPassword(email, password) {
      const anonClient = anonClientFactory();
      const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
      if (error || !data.session || !data.user) {
        return { ok: false, message: error?.message ?? "sign-in failed" };
      }
      return {
        ok: true,
        userId: data.user.id,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      };
    },

    async signOut(accessToken) {
      const { error } = await serviceClient.auth.admin.signOut(accessToken, "global");
      if (error) throw new Error(`signOut: ${error.message}`);
    },

    async listUsers(accessToken) {
      const userClient = userScopedClientFactory(accessToken);
      const { data, error } = await userClient
        .from("app_users")
        .select("*")
        .neq("status", "deactivated")
        .order("display_name", { ascending: true, nullsFirst: false });
      if (error) throw new Error(`listUsers: ${error.message}`);
      return (data as AppUser[]) ?? [];
    },

    async listOwnAuditLog(accessToken, userId) {
      // Queries through the user-scoped client (not service role) so the
      // database's RLS policy enforces "own rows only" independently of
      // this handler's own userId check.
      const userClient = userScopedClientFactory(accessToken);
      const { data, error } = await userClient
        .from("auth_audit_log")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`listOwnAuditLog: ${error.message}`);
      return (data as AuditLogEntry[]) ?? [];
    },

    async enrollMfa(accessToken) {
      const userClient = userScopedClientFactory(accessToken);
      const { data, error } = await userClient.auth.mfa.enroll({ factorType: "totp" });
      if (error || !data) throw new Error(`enrollMfa: ${error?.message ?? "no factor returned"}`);
      return { factorId: data.id, raw: data };
    },

    async verifyMfa(accessToken, params) {
      const userClient = userScopedClientFactory(accessToken);
      const { data, error } = await userClient.auth.mfa.verify({
        factorId: params.factorId,
        challengeId: params.challengeId,
        code: params.code,
      });
      if (error) return { ok: false, message: error.message };
      return { ok: true, raw: data };
    },
  };
}
