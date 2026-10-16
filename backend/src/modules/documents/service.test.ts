import { beforeEach, describe, expect, it } from "vitest";
import { FakeDocumentsRepository } from "../../test/fakeDocumentsRepository.js";
import {
  NotFoundError,
  createDocument,
  createDocumentRevision,
  getDocument,
  getDocumentRevision,
  listDocumentRevisionHistory,
  listDocumentRevisions,
  listDocuments,
  updateDocument,
  updateDocumentRevision,
} from "./service.js";

const TOKEN = "caller-token";
const TENANT_ID = "tenant-a";
const OTHER_TOKEN = "other-tenant-token";
const OTHER_TENANT_ID = "tenant-b";

describe("document register", () => {
  let repo: FakeDocumentsRepository;

  beforeEach(() => {
    repo = new FakeDocumentsRepository();
    repo.addSession(TOKEN, "user-1", TENANT_ID);
    repo.addSession(OTHER_TOKEN, "user-2", OTHER_TENANT_ID);
  });

  it("creates a document with type, number, title, project, discipline, access class and tags", async () => {
    const document = await createDocument(repo, TOKEN, {
      document_type: "drawing",
      title: "Ground Floor Plan",
      document_number: "DWG-001",
      project_id: "project-1",
      discipline: "architectural",
      access_class: "internal",
      tags: ["ifc", "structural"],
      originator_id: "user-1",
    });

    expect(document.document_type).toBe("drawing");
    expect(document.document_number).toBe("DWG-001");
    expect(document.project_id).toBe("project-1");
    expect(document.tags).toEqual(["ifc", "structural"]);
    expect(document.current_revision_id).toBeNull();
    expect(document.tenant_id).toBe(TENANT_ID);
  });

  it("allows a nullable project_id — not every controlled document is project-scoped", async () => {
    const document = await createDocument(repo, TOKEN, {
      document_type: "sop",
      title: "Corporate Safety SOP",
    });

    expect(document.project_id).toBeNull();
  });

  it("lists documents, tenant-isolated", async () => {
    await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc 1" });
    await createDocument(repo, TOKEN, { document_type: "spec", title: "Doc 2" });

    expect(await listDocuments(repo, TOKEN)).toHaveLength(2);
    expect(await listDocuments(repo, OTHER_TOKEN)).toHaveLength(0);
  });

  it("filters list by projectId", async () => {
    await createDocument(repo, TOKEN, { document_type: "drawing", title: "Project A doc", project_id: "project-a" });
    await createDocument(repo, TOKEN, { document_type: "drawing", title: "Project B doc", project_id: "project-b" });

    const filtered = await listDocuments(repo, TOKEN, { projectId: "project-a" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.title).toBe("Project A doc");
  });

  it("getDocument throws NotFoundError for another tenant's document", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc" });
    await expect(getDocument(repo, OTHER_TOKEN, document.id)).rejects.toThrow(NotFoundError);
  });

  it("updateDocument edits metadata", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Original title" });
    const updated = await updateDocument(repo, TOKEN, document.id, { title: "Revised title", discipline: "MEP" });
    expect(updated.title).toBe("Revised title");
    expect(updated.discipline).toBe("MEP");
  });

  it("updateDocument throws NotFoundError when the row doesn't exist", async () => {
    await expect(updateDocument(repo, TOKEN, "does-not-exist", { title: "x" })).rejects.toThrow(NotFoundError);
  });
});

describe("revision control: FR-DOC-002 auto-supersede", () => {
  let repo: FakeDocumentsRepository;

  beforeEach(() => {
    repo = new FakeDocumentsRepository();
    repo.addSession(TOKEN, "user-1", TENANT_ID);
    repo.addSession(OTHER_TOKEN, "user-2", OTHER_TENANT_ID);
  });

  it("creating a first revision sets it as the document's current revision", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc" });
    const revision = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "A",
      created_by: "user-1",
    });

    const refreshedDocument = await getDocument(repo, TOKEN, document.id);
    expect(refreshedDocument.current_revision_id).toBe(revision.id);
    expect(revision.status).toBe("draft");
    expect(revision.superseded_by_revision_id).toBeNull();
  });

  it("creating a new revision when the current one is approved supersedes the old one, in the same call", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc" });
    const revisionA = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "A",
      created_by: "user-1",
    });
    await updateDocumentRevision(repo, TOKEN, revisionA.id, { status: "approved" });

    const revisionB = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "B",
      created_by: "user-1",
    });

    const refreshedA = await getDocumentRevision(repo, TOKEN, revisionA.id);
    expect(refreshedA.status).toBe("superseded");
    expect(refreshedA.superseded_by_revision_id).toBe(revisionB.id);

    const refreshedDocument = await getDocument(repo, TOKEN, document.id);
    expect(refreshedDocument.current_revision_id).toBe(revisionB.id);
  });

  it("creating a new revision when the current one is NOT approved does not supersede it", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc" });
    const revisionA = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "A",
      created_by: "user-1",
    });
    // Still draft — not approved.

    await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "B",
      created_by: "user-1",
    });

    const refreshedA = await getDocumentRevision(repo, TOKEN, revisionA.id);
    expect(refreshedA.status).toBe("draft");
    expect(refreshedA.superseded_by_revision_id).toBeNull();
  });

  it("createDocumentRevision throws NotFoundError for a document in another tenant", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc" });
    await expect(
      createDocumentRevision(repo, OTHER_TOKEN, {
        document_id: document.id,
        revision_code: "A",
        created_by: "user-2",
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("revision list/history defaults", () => {
  let repo: FakeDocumentsRepository;

  beforeEach(() => {
    repo = new FakeDocumentsRepository();
    repo.addSession(TOKEN, "user-1", TENANT_ID);
    repo.addSession(OTHER_TOKEN, "user-2", OTHER_TENANT_ID);
  });

  it("listDocumentRevisions excludes superseded and rejected by default", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc" });
    const revisionA = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "A",
      created_by: "user-1",
    });
    await updateDocumentRevision(repo, TOKEN, revisionA.id, { status: "approved" });
    await createDocumentRevision(repo, TOKEN, {
      // supersedes A
      document_id: document.id,
      revision_code: "B",
      created_by: "user-1",
    });
    const revisionC = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "C-rejected",
      created_by: "user-1",
    });
    await updateDocumentRevision(repo, TOKEN, revisionC.id, { status: "rejected" });

    const defaultView = await listDocumentRevisions(repo, TOKEN, document.id);
    expect(defaultView.map((r) => r.revision_code)).toEqual(["B"]);

    const includeSuperseded = await listDocumentRevisions(repo, TOKEN, document.id, { includeSuperseded: true });
    expect(includeSuperseded).toHaveLength(3);
  });

  it("listDocumentRevisionHistory returns every revision, oldest-to-newest, full metadata", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc" });
    const revisionA = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "A",
      created_by: "user-1",
    });
    await updateDocumentRevision(repo, TOKEN, revisionA.id, { status: "approved" });
    const revisionB = await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "B",
      created_by: "user-1",
    });

    const history = await listDocumentRevisionHistory(repo, TOKEN, document.id);
    expect(history.map((r) => r.revision_code)).toEqual(["A", "B"]);
    expect(history[0]!.status).toBe("superseded");
    expect(history[0]!.superseded_by_revision_id).toBe(revisionB.id);
  });

  it("tenant-isolates revision lists and history", async () => {
    const document = await createDocument(repo, TOKEN, { document_type: "drawing", title: "Doc" });
    await createDocumentRevision(repo, TOKEN, {
      document_id: document.id,
      revision_code: "A",
      created_by: "user-1",
    });

    expect(await listDocumentRevisions(repo, OTHER_TOKEN, document.id)).toHaveLength(0);
    expect(await listDocumentRevisionHistory(repo, OTHER_TOKEN, document.id)).toHaveLength(0);
  });
});
