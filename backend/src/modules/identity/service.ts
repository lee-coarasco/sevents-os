import type { IdentityRepository } from "./repository.js";
import type { AppUser, AuditLogEntry } from "./types.js";

export class UnauthorizedError extends Error {
  constructor(message = "invalid session") {
    super(message);
  }
}

/** Idempotent: re-inviting an already-invited email returns the existing row, not a new one. */
export async function inviteUser(
  repo: IdentityRepository,
  email: string,
  displayName: string | undefined,
  invitedBy: string | null,
): Promise<AppUser> {
  const existing = await repo.findAppUserByEmail(email);
  if (existing) {
    return existing;
  }

  const authUser = await repo.inviteAuthUser(email);
  const appUser = await repo.insertAppUser({
    id: authUser.id,
    email,
    display_name: displayName ?? null,
    invited_by: invitedBy,
  });
  await repo.insertAuditEvent(appUser.id, "invited", { email, invited_by: invitedBy });
  return appUser;
}

/** Idempotent: accepting an invite twice (or for an already-active user) is a no-op. */
export async function acceptInvite(repo: IdentityRepository, userId: string): Promise<AppUser> {
  const activated = await repo.activateAppUser(userId);
  if (activated) {
    await repo.insertAuditEvent(userId, "invite_accepted", {});
    return activated;
  }

  const current = await repo.getAppUserById(userId);
  if (!current) {
    throw new Error("User not found");
  }
  return current;
}

/** Soft deactivation: blocks sign-in via banAuthUser, but the row and its audit trail remain. */
export async function deactivateUser(repo: IdentityRepository, userId: string): Promise<AppUser> {
  await repo.banAuthUser(userId);
  const user = await repo.deactivateAppUser(userId);
  await repo.insertAuditEvent(userId, "deactivated", {});
  return user;
}

export async function signIn(repo: IdentityRepository, email: string, password: string) {
  const result = await repo.signInWithPassword(email, password);
  if (!result.ok) {
    // Don't attribute the audit row to a user id — doing so on a failed
    // attempt would reveal whether the email exists at all.
    await repo.insertAuditEvent(null, "sign_in_failed", { email });
    throw new UnauthorizedError(result.message);
  }
  await repo.insertAuditEvent(result.userId, "sign_in", {});
  return result;
}

export async function signOut(repo: IdentityRepository, accessToken: string): Promise<void> {
  const userId = await repo.getUserIdFromAccessToken(accessToken);
  await repo.signOut(accessToken);
  await repo.insertAuditEvent(userId, "sign_out", {});
}

export async function getOwnAuditLog(
  repo: IdentityRepository,
  accessToken: string,
): Promise<AuditLogEntry[]> {
  const userId = await repo.getUserIdFromAccessToken(accessToken);
  if (!userId) {
    throw new UnauthorizedError();
  }
  return repo.listOwnAuditLog(accessToken, userId);
}

// TODO(ticket 0056): BRD 5.1 requires MFA for "privileged roles," but
// roles/permissions don't exist until M03. Enrollment/verification work
// for any signed-in user today; once role data exists, gate enrollment
// as mandatory-before-activation for privileged roles here rather than
// inventing which roles count as privileged now.

export async function enrollMfa(repo: IdentityRepository, accessToken: string) {
  const userId = await repo.getUserIdFromAccessToken(accessToken);
  if (!userId) {
    throw new UnauthorizedError();
  }
  const factor = await repo.enrollMfa(accessToken);
  await repo.insertAuditEvent(userId, "mfa_enrolled", { factor_id: factor.factorId });
  return factor;
}

export async function verifyMfa(
  repo: IdentityRepository,
  accessToken: string,
  params: { factorId: string; challengeId: string; code: string },
) {
  const userId = await repo.getUserIdFromAccessToken(accessToken);
  if (!userId) {
    throw new UnauthorizedError();
  }
  const result = await repo.verifyMfa(accessToken, params);
  await repo.insertAuditEvent(
    userId,
    result.ok ? "mfa_verified" : "mfa_verification_failed",
    { factor_id: params.factorId },
  );
  if (!result.ok) {
    throw new Error(result.message ?? "MFA verification failed");
  }
  return result;
}
