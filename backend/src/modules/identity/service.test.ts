import { beforeEach, describe, expect, it } from "vitest";
import { FakeIdentityRepository } from "../../test/fakeIdentityRepository.js";
import {
  UnauthorizedError,
  acceptInvite,
  deactivateUser,
  enrollMfa,
  getOwnAuditLog,
  inviteUser,
  listUsers,
  signIn,
  signOut,
  verifyMfa,
} from "./service.js";

describe("inviteUser", () => {
  let repo: FakeIdentityRepository;

  beforeEach(() => {
    repo = new FakeIdentityRepository();
  });

  it("creates a pending user and an 'invited' audit entry", async () => {
    const user = await inviteUser(repo, "new.hire@sevents.test", "New Hire", null);

    expect(user.status).toBe("pending");
    expect(user.email).toBe("new.hire@sevents.test");
    expect(repo.auditLog).toHaveLength(1);
    expect(repo.auditLog[0]?.event_type).toBe("invited");
  });

  it("is idempotent: re-inviting the same email returns the existing row, not a new one", async () => {
    const first = await inviteUser(repo, "dup@sevents.test", "Dup", null);
    const second = await inviteUser(repo, "dup@sevents.test", "Dup", null);

    expect(second.id).toBe(first.id);
    expect(repo.users.size).toBe(1);
    // Only one invite-created audit row, not two.
    expect(repo.auditLog.filter((e) => e.event_type === "invited")).toHaveLength(1);
  });

  it("re-invite is case-insensitive on email", async () => {
    const first = await inviteUser(repo, "Case@Sevents.Test", "Case", null);
    const second = await inviteUser(repo, "case@sevents.test", "Case", null);

    expect(second.id).toBe(first.id);
    expect(repo.users.size).toBe(1);
  });
});

describe("acceptInvite", () => {
  it("activates a pending user and records invite_accepted", async () => {
    const repo = new FakeIdentityRepository();
    const invited = await inviteUser(repo, "activate@sevents.test", undefined, null);

    const activated = await acceptInvite(repo, invited.id);

    expect(activated.status).toBe("active");
    expect(activated.activated_at).not.toBeNull();
    expect(repo.auditLog.some((e) => e.event_type === "invite_accepted")).toBe(true);
  });

  it("is idempotent: accepting twice does not re-activate or duplicate the audit row", async () => {
    const repo = new FakeIdentityRepository();
    const invited = await inviteUser(repo, "twice@sevents.test", undefined, null);

    await acceptInvite(repo, invited.id);
    const second = await acceptInvite(repo, invited.id);

    expect(second.status).toBe("active");
    expect(repo.auditLog.filter((e) => e.event_type === "invite_accepted")).toHaveLength(1);
  });

  it("throws for an unknown user id", async () => {
    const repo = new FakeIdentityRepository();
    await expect(acceptInvite(repo, "nonexistent")).rejects.toThrow("User not found");
  });
});

describe("deactivateUser", () => {
  it("soft-deactivates: row and audit trail remain, sign-in is blocked", async () => {
    const repo = new FakeIdentityRepository();
    const invited = await inviteUser(repo, "leaving@sevents.test", undefined, null);
    await acceptInvite(repo, invited.id);
    repo.addSession("token-leaving", invited.id);

    const deactivated = await deactivateUser(repo, invited.id);

    expect(deactivated.status).toBe("deactivated");
    expect(repo.users.has(invited.id)).toBe(true); // row still exists
    expect(repo.bannedUserIds.has(invited.id)).toBe(true);
    expect(await repo.getUserIdFromAccessToken("token-leaving")).toBeNull(); // sign-in blocked
    expect(repo.auditLog.some((e) => e.event_type === "deactivated")).toBe(true);
  });
});

describe("signIn / signOut", () => {
  it("signs in with the right password and logs sign_in", async () => {
    const repo = new FakeIdentityRepository();
    const user = await inviteUser(repo, "signin@sevents.test", undefined, null);
    await acceptInvite(repo, user.id);
    repo.setPassword(user.id, "correct-password");

    const result = await signIn(repo, "signin@sevents.test", "correct-password");

    expect(result.ok).toBe(true);
    expect(repo.auditLog.some((e) => e.event_type === "sign_in" && e.user_id === user.id)).toBe(
      true,
    );
  });

  it("rejects the wrong password and logs sign_in_failed without attributing a user", async () => {
    const repo = new FakeIdentityRepository();
    const user = await inviteUser(repo, "wrongpw@sevents.test", undefined, null);
    await acceptInvite(repo, user.id);
    repo.setPassword(user.id, "correct-password");

    await expect(signIn(repo, "wrongpw@sevents.test", "nope")).rejects.toThrow(UnauthorizedError);
    const failure = repo.auditLog.find((e) => e.event_type === "sign_in_failed");
    expect(failure).toBeDefined();
    expect(failure?.user_id).toBeNull();
  });

  it("rejects sign-in for a deactivated (banned) user", async () => {
    const repo = new FakeIdentityRepository();
    const user = await inviteUser(repo, "banned@sevents.test", undefined, null);
    await acceptInvite(repo, user.id);
    repo.setPassword(user.id, "correct-password");
    await deactivateUser(repo, user.id);

    await expect(signIn(repo, "banned@sevents.test", "correct-password")).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("signs out and revokes the session, logging sign_out", async () => {
    const repo = new FakeIdentityRepository();
    const user = await inviteUser(repo, "signout@sevents.test", undefined, null);
    await acceptInvite(repo, user.id);
    repo.setPassword(user.id, "correct-password");
    const { accessToken } = await signIn(repo, "signout@sevents.test", "correct-password");

    await signOut(repo, accessToken as string);

    expect(repo.auditLog.some((e) => e.event_type === "sign_out" && e.user_id === user.id)).toBe(
      true,
    );
    expect(await repo.getUserIdFromAccessToken(accessToken as string)).toBeNull();
  });
});

describe("getOwnAuditLog", () => {
  it("rejects a missing/invalid session", async () => {
    const repo = new FakeIdentityRepository();
    await expect(getOwnAuditLog(repo, "no-such-token")).rejects.toThrow(UnauthorizedError);
  });

  it("returns only the caller's own audit entries", async () => {
    const repo = new FakeIdentityRepository();
    const userA = await inviteUser(repo, "a@sevents.test", undefined, null);
    const userB = await inviteUser(repo, "b@sevents.test", undefined, null);
    repo.addSession("token-a", userA.id);

    const entries = await getOwnAuditLog(repo, "token-a");

    expect(entries.every((e) => e.user_id === userA.id)).toBe(true);
    expect(entries.some((e) => e.user_id === userB.id)).toBe(false);
  });
});

describe("listUsers", () => {
  it("rejects a missing/invalid session", async () => {
    const repo = new FakeIdentityRepository();
    await expect(listUsers(repo, "no-such-token")).rejects.toThrow(UnauthorizedError);
  });

  it("lists every non-deactivated user, sorted by display name", async () => {
    const repo = new FakeIdentityRepository();
    const userA = await inviteUser(repo, "a@sevents.test", "Zara", null);
    await inviteUser(repo, "b@sevents.test", "Amir", null);
    const userC = await inviteUser(repo, "c@sevents.test", "Deactivated", null);
    await deactivateUser(repo, userC.id);
    repo.addSession("token-a", userA.id);

    const users = await listUsers(repo, "token-a");

    expect(users.map((u) => u.display_name)).toEqual(["Amir", "Zara"]);
    expect(users.some((u) => u.id === userC.id)).toBe(false);
  });
});

describe("MFA enrollment and verification", () => {
  it("enrolls a factor and logs mfa_enrolled", async () => {
    const repo = new FakeIdentityRepository();
    const user = await inviteUser(repo, "mfa@sevents.test", undefined, null);
    repo.addSession("token-mfa", user.id);

    const factor = await enrollMfa(repo, "token-mfa");

    expect(factor.factorId).toBeTruthy();
    expect(repo.auditLog.some((e) => e.event_type === "mfa_enrolled")).toBe(true);
  });

  it("logs mfa_verified on success", async () => {
    const repo = new FakeIdentityRepository();
    const user = await inviteUser(repo, "mfa-ok@sevents.test", undefined, null);
    repo.addSession("token-mfa-ok", user.id);
    repo.verifyShouldSucceed = true;

    await verifyMfa(repo, "token-mfa-ok", {
      factorId: "factor-1",
      challengeId: "challenge-1",
      code: "123456",
    });

    expect(repo.auditLog.some((e) => e.event_type === "mfa_verified")).toBe(true);
  });

  it("logs mfa_verification_failed and throws on bad code", async () => {
    const repo = new FakeIdentityRepository();
    const user = await inviteUser(repo, "mfa-bad@sevents.test", undefined, null);
    repo.addSession("token-mfa-bad", user.id);
    repo.verifyShouldSucceed = false;

    await expect(
      verifyMfa(repo, "token-mfa-bad", {
        factorId: "factor-1",
        challengeId: "challenge-1",
        code: "000000",
      }),
    ).rejects.toThrow();

    expect(repo.auditLog.some((e) => e.event_type === "mfa_verification_failed")).toBe(true);
  });

  it("rejects enroll/verify for an unauthenticated caller", async () => {
    const repo = new FakeIdentityRepository();
    await expect(enrollMfa(repo, "bad-token")).rejects.toThrow(UnauthorizedError);
    await expect(
      verifyMfa(repo, "bad-token", { factorId: "x", challengeId: "y", code: "z" }),
    ).rejects.toThrow(UnauthorizedError);
  });
});
