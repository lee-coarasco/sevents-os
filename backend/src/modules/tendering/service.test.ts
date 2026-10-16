import { beforeEach, describe, expect, it } from "vitest";
import { FakeTenderingRepository } from "../../test/fakeTenderingRepository.js";
import {
  NotFoundError,
  createTenderClarification,
  createTenderDocument,
  listTenderClarifications,
  listTenderDocuments,
  resolveTenderClarification,
  updateTenderClarification,
} from "./service.js";

const TOKEN = "caller-token";
const TENANT_ID = "tenant-a";
const OTHER_TOKEN = "other-tenant-token";
const OTHER_TENANT_ID = "tenant-b";
const TENDER_SUBMISSION_ID = "tender-submission-1";

describe("tender document register", () => {
  let repo: FakeTenderingRepository;

  beforeEach(() => {
    repo = new FakeTenderingRepository();
    repo.addSession(TOKEN, "user-1", TENANT_ID);
    repo.addSession(OTHER_TOKEN, "user-2", OTHER_TENANT_ID);
  });

  it("creates a tender document with type, title, revision, received date and a storage reference", async () => {
    const document = await createTenderDocument(repo, TOKEN, {
      tender_submission_id: TENDER_SUBMISSION_ID,
      document_type: "boq",
      title: "Bill of Quantities — Phase 1",
      document_number: "BOQ-001",
      revision: "Rev B",
      received_date: "2026-11-01",
      storage_reference: "https://files.example.com/boq-001-revB.pdf",
      created_by: "user-1",
    });

    expect(document.document_type).toBe("boq");
    expect(document.revision).toBe("Rev B");
    expect(document.storage_reference).toContain("boq-001-revB.pdf");
    expect(document.tenant_id).toBe(TENANT_ID);
  });

  it("lists documents for a tender submission", async () => {
    await createTenderDocument(repo, TOKEN, {
      tender_submission_id: TENDER_SUBMISSION_ID,
      document_type: "drawing",
      title: "Site layout",
      created_by: null,
    });
    await createTenderDocument(repo, TOKEN, {
      tender_submission_id: TENDER_SUBMISSION_ID,
      document_type: "addendum",
      title: "Addendum 1",
      created_by: null,
    });

    const documents = await listTenderDocuments(repo, TOKEN, TENDER_SUBMISSION_ID);

    expect(documents).toHaveLength(2);
  });

  it("tenant-isolates the document register: another tenant never sees these rows", async () => {
    await createTenderDocument(repo, TOKEN, {
      tender_submission_id: TENDER_SUBMISSION_ID,
      document_type: "specification",
      title: "Technical spec",
      created_by: null,
    });

    const documents = await listTenderDocuments(repo, OTHER_TOKEN, TENDER_SUBMISSION_ID);

    expect(documents).toHaveLength(0);
  });
});

describe("scope matrix / clarification log", () => {
  let repo: FakeTenderingRepository;

  beforeEach(() => {
    repo = new FakeTenderingRepository();
    repo.addSession(TOKEN, "user-1", TENANT_ID);
    repo.addSession(OTHER_TOKEN, "user-2", OTHER_TENANT_ID);
  });

  it("raises a clarification with item and raised_by, unresolved by default", async () => {
    const clarification = await createTenderClarification(repo, TOKEN, {
      tender_submission_id: TENDER_SUBMISSION_ID,
      item: "Drawing set contradicts BOQ quantities for concrete grade",
      raised_by: "user-1",
    });

    expect(clarification.item).toContain("contradicts");
    expect(clarification.raised_by).toBe("user-1");
    expect(clarification.response).toBeNull();
    expect(clarification.resolved_at).toBeNull();
  });

  it("resolveTenderClarification sets response and resolved_at together", async () => {
    const clarification = await createTenderClarification(repo, TOKEN, {
      tender_submission_id: TENDER_SUBMISSION_ID,
      item: "Missing structural drawing for basement level",
      raised_by: "user-1",
    });

    const resolved = await resolveTenderClarification(repo, TOKEN, clarification.id, "Drawing issued as Addendum 2");

    expect(resolved.response).toBe("Drawing issued as Addendum 2");
    expect(resolved.resolved_at).not.toBeNull();
  });

  it("resolveTenderClarification throws NotFoundError for another tenant's clarification", async () => {
    const clarification = await createTenderClarification(repo, TOKEN, {
      tender_submission_id: TENDER_SUBMISSION_ID,
      item: "Commercial risk: payment terms unclear",
      raised_by: "user-1",
    });

    await expect(resolveTenderClarification(repo, OTHER_TOKEN, clarification.id, "n/a")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("updateTenderClarification throws NotFoundError when the row doesn't exist", async () => {
    await expect(updateTenderClarification(repo, TOKEN, "does-not-exist", { response: "x" })).rejects.toThrow(
      NotFoundError,
    );
  });

  it("lists clarifications for a tender submission, tenant-isolated", async () => {
    await createTenderClarification(repo, TOKEN, {
      tender_submission_id: TENDER_SUBMISSION_ID,
      item: "Query 1",
      raised_by: "user-1",
    });
    await createTenderClarification(repo, TOKEN, {
      tender_submission_id: TENDER_SUBMISSION_ID,
      item: "Query 2",
      raised_by: "user-1",
    });

    expect(await listTenderClarifications(repo, TOKEN, TENDER_SUBMISSION_ID)).toHaveLength(2);
    expect(await listTenderClarifications(repo, OTHER_TOKEN, TENDER_SUBMISSION_ID)).toHaveLength(0);
  });
});
