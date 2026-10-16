import { describe, expect, it } from "vitest";
import { FakeNotificationsRepository } from "../../test/fakeNotificationsRepository.js";
import type { NotificationSender } from "./types.js";
import {
  MaxRetriesExceededError,
  NotificationNotRetryableError,
  RetryPolicyNotConfiguredError,
  TemplateNotFoundError,
  dispatchNotification,
  retryNotification,
} from "./service.js";

const TOKEN = "admin-token";
const TENANT = "tenant-a";

function repoWithTemplate() {
  const repo = new FakeNotificationsRepository();
  repo.addSession(TOKEN, TENANT);
  const template = {
    id: "template-1",
    tenant_id: TENANT,
    template_key: "welcome",
    channel: "email" as const,
    subject: "Hi {{name}}",
    body: "Welcome, {{name}}!",
  };
  repo.templates.set(template.id, template);
  return repo;
}

const okSender: NotificationSender = {
  send: async () => ({ success: true }),
};

const failingSender: NotificationSender = {
  send: async () => ({ success: false, failureReason: "smtp timeout" }),
};

describe("dispatchNotification", () => {
  it("throws TemplateNotFoundError when no template matches the key+channel", async () => {
    const repo = new FakeNotificationsRepository();
    repo.addSession(TOKEN, TENANT);
    await expect(
      dispatchNotification(repo, okSender, TENANT, {
        recipientId: "user-1",
        templateKey: "missing",
        channel: "email",
        dedupKey: "dedup-1",
      }),
    ).rejects.toThrow(TemplateNotFoundError);
  });

  it("renders the template and delivers via the sender", async () => {
    const repo = repoWithTemplate();
    const { notification, deduped } = await dispatchNotification(repo, okSender, TENANT, {
      recipientId: "user-1",
      templateKey: "welcome",
      channel: "email",
      dedupKey: "dedup-1",
      variables: { name: "Alice" },
    });
    expect(deduped).toBe(false);
    expect(notification.rendered_subject).toBe("Hi Alice");
    expect(notification.rendered_body).toBe("Welcome, Alice!");
    expect(notification.status).toBe("sent");
    expect(notification.attempt_count).toBe(1);
    expect(notification.delivered_at).not.toBeNull();
  });

  it("marks in_app notifications as sent without calling the sender", async () => {
    const repo = new FakeNotificationsRepository();
    repo.addSession(TOKEN, TENANT);
    repo.templates.set("t1", {
      id: "t1",
      tenant_id: TENANT,
      template_key: "task-assigned",
      channel: "in_app",
      subject: null,
      body: "You were assigned a task",
    });
    let sendCalled = false;
    const sender: NotificationSender = { send: async () => { sendCalled = true; return { success: true }; } };

    const { notification } = await dispatchNotification(repo, sender, TENANT, {
      recipientId: "user-1",
      templateKey: "task-assigned",
      channel: "in_app",
      dedupKey: "dedup-1",
    });
    expect(sendCalled).toBe(false);
    expect(notification.status).toBe("sent");
  });

  it("records a failed delivery with the sender's failure reason", async () => {
    const repo = repoWithTemplate();
    const { notification } = await dispatchNotification(repo, failingSender, TENANT, {
      recipientId: "user-1",
      templateKey: "welcome",
      channel: "email",
      dedupKey: "dedup-1",
    });
    expect(notification.status).toBe("failed");
    expect(notification.failure_reason).toBe("smtp timeout");
    expect(notification.delivered_at).toBeNull();
  });

  it("does not create a second row for the same dedupKey+recipient, and does not re-send", async () => {
    const repo = repoWithTemplate();
    let sendCount = 0;
    const countingSender: NotificationSender = {
      send: async () => {
        sendCount += 1;
        return { success: true };
      },
    };

    const first = await dispatchNotification(repo, countingSender, TENANT, {
      recipientId: "user-1",
      templateKey: "welcome",
      channel: "email",
      dedupKey: "same-key",
    });
    const second = await dispatchNotification(repo, countingSender, TENANT, {
      recipientId: "user-1",
      templateKey: "welcome",
      channel: "email",
      dedupKey: "same-key",
    });

    expect(sendCount).toBe(1);
    expect(second.deduped).toBe(true);
    expect(second.notification.id).toBe(first.notification.id);
  });

  it("dedup is per-recipient: the same dedupKey for a different recipient is a separate notification", async () => {
    const repo = repoWithTemplate();
    const forAlice = await dispatchNotification(repo, okSender, TENANT, {
      recipientId: "alice",
      templateKey: "welcome",
      channel: "email",
      dedupKey: "same-key",
    });
    const forBob = await dispatchNotification(repo, okSender, TENANT, {
      recipientId: "bob",
      templateKey: "welcome",
      channel: "email",
      dedupKey: "same-key",
    });
    expect(forAlice.notification.id).not.toBe(forBob.notification.id);
  });
});

describe("retryNotification", () => {
  it("throws RetryPolicyNotConfiguredError when no policy exists for the channel", async () => {
    const repo = repoWithTemplate();
    const { notification } = await dispatchNotification(repo, failingSender, TENANT, {
      recipientId: "user-1",
      templateKey: "welcome",
      channel: "email",
      dedupKey: "dedup-1",
    });
    await expect(retryNotification(repo, okSender, TENANT, notification.id)).rejects.toThrow(
      RetryPolicyNotConfiguredError,
    );
  });

  it("throws NotificationNotRetryableError for a notification that is not failed", async () => {
    const repo = repoWithTemplate();
    const { notification } = await dispatchNotification(repo, okSender, TENANT, {
      recipientId: "user-1",
      templateKey: "welcome",
      channel: "email",
      dedupKey: "dedup-1",
    });
    repo.retryPolicies.set(`${TENANT}:email`, {
      id: "policy-1",
      tenant_id: TENANT,
      channel: "email",
      max_attempts: 3,
      backoff_seconds: 60,
    });
    await expect(retryNotification(repo, okSender, TENANT, notification.id)).rejects.toThrow(
      NotificationNotRetryableError,
    );
  });

  it("retries a failed notification and can succeed on the next attempt", async () => {
    const repo = repoWithTemplate();
    repo.retryPolicies.set(`${TENANT}:email`, {
      id: "policy-1",
      tenant_id: TENANT,
      channel: "email",
      max_attempts: 3,
      backoff_seconds: 60,
    });
    const { notification } = await dispatchNotification(repo, failingSender, TENANT, {
      recipientId: "user-1",
      templateKey: "welcome",
      channel: "email",
      dedupKey: "dedup-1",
    });
    expect(notification.attempt_count).toBe(1);

    const retried = await retryNotification(repo, okSender, TENANT, notification.id);
    expect(retried.status).toBe("sent");
    expect(retried.attempt_count).toBe(2);
  });

  it("throws MaxRetriesExceededError once attempt_count reaches the configured max", async () => {
    const repo = repoWithTemplate();
    repo.retryPolicies.set(`${TENANT}:email`, {
      id: "policy-1",
      tenant_id: TENANT,
      channel: "email",
      max_attempts: 1,
      backoff_seconds: 60,
    });
    const { notification } = await dispatchNotification(repo, failingSender, TENANT, {
      recipientId: "user-1",
      templateKey: "welcome",
      channel: "email",
      dedupKey: "dedup-1",
    });
    expect(notification.attempt_count).toBe(1);

    await expect(retryNotification(repo, okSender, TENANT, notification.id)).rejects.toThrow(
      MaxRetriesExceededError,
    );
  });
});
