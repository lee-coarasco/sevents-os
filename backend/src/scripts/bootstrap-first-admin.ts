import { createServiceClient } from "../lib/supabase.js";
import { bootstrapFirstAdmin, createSupabaseBootstrapRepository } from "../modules/identity/bootstrap.js";

/**
 * Admin-only CLI, run via `npm run bootstrap:admin` from backend/ — same
 * "service-role bootstrap step, not a self-service API" precedent as
 * `import-catalogue.ts`. Creates the very first Platform Administrator so
 * there is a user to log in with at all (ticket 0093). Safe to re-run:
 * `bootstrapFirstAdmin` is idempotent on email/tenant name/role assignment.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Set BOOTSTRAP_ADMIN_EMAIL and ` +
        `BOOTSTRAP_ADMIN_PASSWORD (and optionally BOOTSTRAP_TENANT_NAME, BOOTSTRAP_ADMIN_DISPLAY_NAME) ` +
        `before running this script.`,
    );
  }
  return value;
}

async function main() {
  const email = requireEnv("BOOTSTRAP_ADMIN_EMAIL");
  const password = requireEnv("BOOTSTRAP_ADMIN_PASSWORD");
  const tenantName = process.env.BOOTSTRAP_TENANT_NAME ?? "Default Tenant";
  const displayName = process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME ?? null;

  const repo = createSupabaseBootstrapRepository(createServiceClient());
  const result = await bootstrapFirstAdmin(repo, { email, password, tenantName, displayName });

  if (result.created) {
    console.log(
      `Bootstrapped Platform Administrator "${email}" (user ${result.userId}) ` +
        `in tenant "${tenantName}" (${result.tenantId}). Log in at the frontend with this email/password.`,
    );
  } else {
    console.log(
      `"${email}" is already a Platform Administrator in tenant "${tenantName}" (${result.tenantId}) — ` +
        `nothing to do. Re-running this script is always safe.`,
    );
  }
}

main().catch((error) => {
  console.error("bootstrap-first-admin failed:", error);
  process.exitCode = 1;
});
