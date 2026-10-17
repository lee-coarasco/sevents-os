import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedRequest } from "../../authority/guard.js";

export interface AdminUsersRouteOptions {
  getServiceClient: () => SupabaseClient;
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

interface TenantUser {
  id: string;
  email: string;
  display_name: string | null;
  role_id: string | null;
  role_label: string | null;
  status: string;
  invited_at: string;
  created_at: string;
}

export async function adminUsersRoutes(app: FastifyInstance, options: AdminUsersRouteOptions) {
  const guard = options.requirePermission("admin.users.manage");

  app.get("/admin/users", { preHandler: guard }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    const tenantId = req.authTenantId;
    if (!tenantId) {
      reply.code(401);
      return { error: "missing tenant context" };
    }

    const supabase = options.getServiceClient();

    // Fetch all app_users in this tenant
    const { data: appUsers, error: usersError } = await supabase
      .from("app_users")
      .select("id, email, display_name, status, invited_at, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });

    if (usersError) {
      reply.code(500);
      return { error: usersError.message };
    }

    // Fetch active role assignments for these users
    const userIds = (appUsers ?? []).map((u: { id: string }) => u.id);
    let rolesByUser = new Map<string, { role_id: string; role_label: string }>();

    if (userIds.length > 0) {
      const { data: assignments } = await supabase
        .from("role_assignments")
        .select("user_id, role_id, role_definitions(label)")
        .eq("tenant_id", tenantId)
        .is("valid_to", null)
        .in("user_id", userIds);

      for (const a of assignments ?? []) {
        const rdRaw = a.role_definitions;
        const rd = Array.isArray(rdRaw) ? (rdRaw[0] as { label: string } | undefined) : (rdRaw as { label: string } | null);
        rolesByUser.set(a.user_id, {
          role_id: a.role_id,
          role_label: rd?.label ?? a.role_id,
        });
      }
    }

    const users: TenantUser[] = (appUsers ?? []).map(
      (u: { id: string; email: string; display_name: string | null; status: string; created_at: string }) => ({
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        role_id: rolesByUser.get(u.id)?.role_id ?? null,
        role_label: rolesByUser.get(u.id)?.role_label ?? null,
        status: u.status,
        created_at: u.created_at,
      }),
    );

    return { users };
  });

  app.post<{ Body: { email: string; role_id: string; display_name?: string } }>(
    "/admin/users/invite",
    { preHandler: guard },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const tenantId = req.authTenantId;
      const invitedBy = req.authUserId;
      if (!tenantId) {
        reply.code(401);
        return { error: "missing tenant context" };
      }

      const { email, role_id, display_name } = request.body ?? ({} as { email: string; role_id: string });
      if (!email || !role_id) {
        reply.code(400);
        return { error: "email and role_id are required" };
      }

      const supabase = options.getServiceClient();

      // Check if user already exists in this tenant
      const { data: existing } = await supabase
        .from("app_users")
        .select("id")
        .eq("email", email.toLowerCase())
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existing) {
        reply.code(409);
        return { error: "A user with this email already exists in this tenant" };
      }

      // Send Supabase invite email
      const { data: authData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email);
      if (inviteError || !authData?.user) {
        reply.code(500);
        return { error: inviteError?.message ?? "Failed to send invite" };
      }

      const authUserId = authData.user.id;

      // Upsert app_users row (might already exist from a different tenant invite)
      const { data: appUser, error: insertError } = await supabase
        .from("app_users")
        .upsert(
          {
            id: authUserId,
            email: email.toLowerCase(),
            display_name: display_name ?? null,
            tenant_id: tenantId,
            invited_by: invitedBy ?? null,
            status: "pending",
          },
          { onConflict: "id" },
        )
        .select()
        .single();

      if (insertError) {
        reply.code(500);
        return { error: insertError.message };
      }

      // Assign the requested role
      const { error: roleError } = await supabase.from("role_assignments").insert({
        tenant_id: tenantId,
        user_id: authUserId,
        role_id,
        created_by: invitedBy ?? null,
      });

      if (roleError) {
        reply.code(500);
        return { error: `User invited but role assignment failed: ${roleError.message}` };
      }

      reply.code(201);
      return { user: appUser };
    },
  );

  app.patch<{ Params: { id: string }; Body: { role_id: string } }>(
    "/admin/users/:id/role",
    { preHandler: guard },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const tenantId = req.authTenantId;
      const actorId = req.authUserId;
      if (!tenantId) {
        reply.code(401);
        return { error: "missing tenant context" };
      }

      const { id } = request.params;
      const { role_id } = request.body ?? ({} as { role_id: string });
      if (!role_id) {
        reply.code(400);
        return { error: "role_id is required" };
      }

      const supabase = options.getServiceClient();

      // Expire current active assignment(s)
      const now = new Date().toISOString();
      await supabase
        .from("role_assignments")
        .update({ valid_to: now })
        .eq("user_id", id)
        .eq("tenant_id", tenantId)
        .is("valid_to", null);

      // Insert new assignment
      const { error: assignError } = await supabase.from("role_assignments").insert({
        tenant_id: tenantId,
        user_id: id,
        role_id,
        created_by: actorId ?? null,
      });

      if (assignError) {
        reply.code(500);
        return { error: assignError.message };
      }

      return { ok: true };
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/admin/users/:id/deactivate",
    { preHandler: guard },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const tenantId = req.authTenantId;
      if (!tenantId) {
        reply.code(401);
        return { error: "missing tenant context" };
      }

      const { id } = request.params;
      const supabase = options.getServiceClient();

      // Ban the auth user (blocks sign-in without deleting the row)
      const { error: banError } = await supabase.auth.admin.updateUserById(id, {
        ban_duration: "876600h", // ~100 years
      });
      if (banError) {
        reply.code(500);
        return { error: banError.message };
      }

      // Update app_users status
      const { data: user, error: updateError } = await supabase
        .from("app_users")
        .update({ status: "deactivated", deactivated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select()
        .single();

      if (updateError) {
        reply.code(500);
        return { error: updateError.message };
      }

      return { user };
    },
  );
}
