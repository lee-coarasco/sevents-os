import type { IdentityRepository } from "../modules/identity/repository.js";
import type { AppUser, AuditEventType, AuditLogEntry } from "../modules/identity/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * In-memory stand-in for IdentityRepository. No Supabase/network involved —
 * exercises the exact same contract service.ts and routes.ts depend on, so
 * tests stay meaningful without needing a live Supabase project.
 */
export class FakeIdentityRepository implements IdentityRepository {
  users = new Map<string, AppUser>();
  auditLog: AuditLogEntry[] = [];
  bannedUserIds = new Set<string>();
  /** Maps a fake "access token" to the user id it authenticates as. */
  sessions = new Map<string, string>();
  mfaFactors = new Map<string, { userId: string }>();
  verifyShouldSucceed = true;
  /** userId -> password, set by tests that exercise sign-in (never populated by invite/accept). */
  passwords = new Map<string, string>();

  addSession(accessToken: string, userId: string) {
    this.sessions.set(accessToken, userId);
  }

  setPassword(userId: string, password: string) {
    this.passwords.set(userId, password);
  }

  async findAppUserByEmail(email: string) {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) return user;
    }
    return null;
  }

  async getAppUserById(userId: string) {
    return this.users.get(userId) ?? null;
  }

  async insertAppUser(user: {
    id: string;
    email: string;
    display_name: string | null;
    invited_by: string | null;
  }) {
    const appUser: AppUser = {
      ...user,
      status: "pending",
      invited_at: new Date().toISOString(),
      activated_at: null,
      deactivated_at: null,
    };
    this.users.set(appUser.id, appUser);
    return appUser;
  }

  async activateAppUser(userId: string) {
    const user = this.users.get(userId);
    if (!user || user.status !== "pending") return null;
    const updated: AppUser = { ...user, status: "active", activated_at: new Date().toISOString() };
    this.users.set(userId, updated);
    return updated;
  }

  async deactivateAppUser(userId: string) {
    const user = this.users.get(userId);
    if (!user) throw new Error("deactivateAppUser: user not found");
    const updated: AppUser = {
      ...user,
      status: "deactivated",
      deactivated_at: new Date().toISOString(),
    };
    this.users.set(userId, updated);
    return updated;
  }

  async anonymizeAppUser(userId: string) {
    const user = this.users.get(userId);
    if (!user) throw new Error("anonymizeAppUser: user not found");
    const updated: AppUser = {
      ...user,
      email: `deleted-${userId}@anonymized.invalid`,
      display_name: null,
      status: "deactivated",
      deactivated_at: new Date().toISOString(),
    };
    this.users.set(userId, updated);
    this.bannedUserIds.add(userId);
    return updated;
  }

  async insertAuditEvent(
    userId: string | null,
    eventType: AuditEventType,
    metadata: Record<string, unknown>,
  ) {
    this.auditLog.push({
      id: nextId("audit"),
      user_id: userId,
      event_type: eventType,
      metadata,
      created_at: new Date().toISOString(),
    });
  }

  async inviteAuthUser(_email: string) {
    return { id: nextId("auth-user") };
  }

  async banAuthUser(userId: string) {
    this.bannedUserIds.add(userId);
  }

  async getUserIdFromAccessToken(accessToken: string) {
    const userId = this.sessions.get(accessToken) ?? null;
    if (userId && this.bannedUserIds.has(userId)) return null;
    return userId;
  }

  async signInWithPassword(email: string, password: string) {
    const user = await this.findAppUserByEmail(email);
    if (!user || this.bannedUserIds.has(user.id) || this.passwords.get(user.id) !== password) {
      return { ok: false as const, message: "invalid credentials" };
    }
    const accessToken = `token-${user.id}`;
    this.sessions.set(accessToken, user.id);
    return {
      ok: true as const,
      userId: user.id,
      accessToken,
      refreshToken: `refresh-${user.id}`,
    };
  }

  async signOut(accessToken: string) {
    this.sessions.delete(accessToken);
  }

  async listOwnAuditLog(_accessToken: string, userId: string) {
    return this.auditLog
      .filter((entry) => entry.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async enrollMfa(accessToken: string) {
    const userId = this.sessions.get(accessToken);
    const factorId = nextId("factor");
    this.mfaFactors.set(factorId, { userId: userId ?? "" });
    return { factorId, raw: { id: factorId } };
  }

  async verifyMfa(
    _accessToken: string,
    params: { factorId: string; challengeId: string; code: string },
  ) {
    if (!this.verifyShouldSucceed) {
      return { ok: false, message: "invalid code" };
    }
    return { ok: true, raw: { factorId: params.factorId } };
  }
}
