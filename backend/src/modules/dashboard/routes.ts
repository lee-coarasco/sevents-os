import type { FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface DashboardRouteOptions {
  getUserScopedClient: (accessToken: string) => SupabaseClient;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function dashboardRoutes(app: FastifyInstance, options: DashboardRouteOptions) {
  app.addHook("preHandler", async (request, reply) => {
    if (!bearerToken(request.headers.authorization)) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
  });

  // GET /dashboard/summary — aggregate counts for the platform overview tiles
  app.get("/dashboard/summary", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const client = options.getUserScopedClient(token);

    const [
      { count: companiesCount },
      { count: projectsCount },
      { count: employeesCount },
      { count: workflowsCount },
      { count: documentsCount },
      { count: openTasksCount },
    ] = await Promise.all([
      client.from("companies").select("*", { count: "exact", head: true }),
      client.from("projects").select("*", { count: "exact", head: true }),
      client.from("employees").select("*", { count: "exact", head: true }).eq("status", "active"),
      client.from("workflow_definitions").select("*", { count: "exact", head: true }).eq("status", "published"),
      client.from("documents").select("*", { count: "exact", head: true }),
      client.from("workflow_instances").select("*", { count: "exact", head: true }).eq("status", "running"),
    ]);

    return {
      summary: {
        companies: companiesCount ?? 0,
        projects: projectsCount ?? 0,
        activeEmployees: employeesCount ?? 0,
        publishedWorkflows: workflowsCount ?? 0,
        documents: documentsCount ?? 0,
        openTasks: openTasksCount ?? 0,
      },
    };
  });
}
