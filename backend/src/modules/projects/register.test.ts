import { beforeEach, describe, expect, it } from "vitest";
import { FakeProjectsRepository } from "../../test/fakeProjectsRepository.js";
import { NotFoundError, createProject, createRegisterEntry, listRegisterEntries, updateRegisterEntry } from "./service.js";
import { REGISTER_ENTRY_KINDS } from "./types.js";

describe("M09d: issue/risk/decision/assumption/dependency/change-request register (ticket 0076)", () => {
  let repo: FakeProjectsRepository;
  const tokenA = "token-tenant-a";
  const tokenB = "token-tenant-b";
  let projectId: string;

  beforeEach(async () => {
    repo = new FakeProjectsRepository();
    repo.addSession(tokenA, "tenant-a");
    repo.addSession(tokenB, "tenant-b");
    const project = await createProject(repo, tokenA, { company_id: "company-1", name: "A Tower" });
    projectId = project.id;
  });

  it.each(REGISTER_ENTRY_KINDS)("creates a %s entry defaulting to status 'open'", async (kind) => {
    const entry = await createRegisterEntry(repo, tokenA, {
      projectId,
      kind,
      title: `A ${kind}`,
      raisedBy: "user-a",
    });
    expect(entry.kind).toBe(kind);
    expect(entry.status).toBe("open");
    expect(entry.raised_by).toBe("user-a");
  });

  it("risk entries carry free-text likelihood/impact, never a computed score", async () => {
    const entry = await createRegisterEntry(repo, tokenA, {
      projectId,
      kind: "risk",
      title: "Supplier delay",
      raisedBy: "user-a",
      likelihood: "medium",
      impact: "high",
    });
    expect(entry.likelihood).toBe("medium");
    expect(entry.impact).toBe("high");
  });

  it("a change_request entry is a logged record only — createRegisterEntry never starts a workflow instance", async () => {
    const entry = await createRegisterEntry(repo, tokenA, {
      projectId,
      kind: "change_request",
      title: "Add a second lift core",
      raisedBy: "user-a",
    });
    expect(entry.kind).toBe("change_request");
    expect((entry as unknown as { workflow_instance_id?: unknown }).workflow_instance_id).toBeUndefined();
  });

  it("lists entries filtered by kind and by status", async () => {
    await createRegisterEntry(repo, tokenA, { projectId, kind: "issue", title: "Site access blocked", raisedBy: "user-a" });
    const risk = await createRegisterEntry(repo, tokenA, { projectId, kind: "risk", title: "Weather delay", raisedBy: "user-a" });
    await updateRegisterEntry(repo, tokenA, risk.id, { status: "resolved" });

    const risksOnly = await listRegisterEntries(repo, tokenA, projectId, { kind: "risk" });
    expect(risksOnly).toHaveLength(1);
    expect(risksOnly[0]!.kind).toBe("risk");

    const resolvedOnly = await listRegisterEntries(repo, tokenA, projectId, { status: "resolved" });
    expect(resolvedOnly).toHaveLength(1);
    expect(resolvedOnly[0]!.id).toBe(risk.id);

    const all = await listRegisterEntries(repo, tokenA, projectId);
    expect(all).toHaveLength(2);
  });

  it("updateRegisterEntry can resolve an entry with a resolution note", async () => {
    const entry = await createRegisterEntry(repo, tokenA, { projectId, kind: "decision", title: "Use precast panels", raisedBy: "user-a" });
    const resolved = await updateRegisterEntry(repo, tokenA, entry.id, {
      status: "resolved",
      resolved_at: "2026-11-01T00:00:00.000Z",
      resolution_note: "Approved in design review",
    });
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolution_note).toBe("Approved in design review");
  });

  it("tenant isolation: another tenant cannot list or update a register entry", async () => {
    const entry = await createRegisterEntry(repo, tokenA, { projectId, kind: "assumption", title: "Ground conditions as surveyed", raisedBy: "user-a" });

    const listedByB = await listRegisterEntries(repo, tokenB, projectId);
    expect(listedByB).toHaveLength(0);

    await expect(updateRegisterEntry(repo, tokenB, entry.id, { status: "closed" })).rejects.toBeInstanceOf(NotFoundError);
  });
});
