import type { FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../../lib/env.js";

export interface StorageRouteOptions {
  getServiceClient: () => SupabaseClient;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

const BUCKET = "attachments";

export async function storageRoutes(app: FastifyInstance, options: StorageRouteOptions) {
  app.addHook("preHandler", async (request, reply) => {
    if (!bearerToken(request.headers.authorization)) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
  });

  // POST /storage/signed-upload-url — generates a signed upload URL to allow direct uploads from client, bypassing Vercel request body limits
  app.post("/storage/signed-upload-url", async (request, reply) => {
    const body = (request.body as { originalName?: string; mimeType?: string }) || {};
    const originalName = body.originalName || "upload";
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2)}-${sanitizedName}`;

    const client = options.getServiceClient();
    const { data, error } = await client.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      reply.code(500);
      return { error: `Failed to create signed upload URL: ${error?.message ?? "unknown"}` };
    }

    const { data: publicData } = client.storage.from(BUCKET).getPublicUrl(storagePath);

    return {
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
      storagePath,
      publicUrl: publicData.publicUrl,
    };
  });

  // POST /storage/upload — accepts multipart, stores to Supabase Storage
  app.post("/storage/upload", { bodyLimit: 50 * 1024 * 1024, config: { rawBody: false } }, async (request, reply) => {
    const contentType = request.headers["content-type"] ?? "";
    if (!contentType.includes("multipart/form-data")) {
      reply.code(400);
      return { error: "multipart/form-data required" };
    }

    // Parse multipart manually from raw body using fastify's built-in
    const data = await request.file?.();
    if (!data) {
      reply.code(400);
      return { error: "no file in request" };
    }

    const buffer = await data.toBuffer();
    const mimeType = data.mimetype || "application/octet-stream";
    const originalName = data.filename || "upload";
    // Generate a unique storage path: timestamp + random + original name
    const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2)}-${originalName}`;

    const client = options.getServiceClient();
    const { error } = await client.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });
    if (error) {
      reply.code(500);
      return { error: `Storage upload failed: ${error.message}` };
    }

    const { data: publicData } = client.storage.from(BUCKET).getPublicUrl(storagePath);

    return {
      url: publicData.publicUrl,
      path: storagePath,
      size: buffer.length,
      mimeType,
      originalName,
    };
  });

  // DELETE /storage/*path — deletes a stored file
  app.delete("/storage/*", async (request, reply) => {
    const params = request.params as Record<string, string>;
    const filePath = params["*"];
    if (!filePath) {
      reply.code(400);
      return { error: "path required" };
    }

    const client = options.getServiceClient();
    const { error } = await client.storage.from(BUCKET).remove([filePath]);
    if (error) {
      reply.code(500);
      return { error: `Delete failed: ${error.message}` };
    }

    return { deleted: true };
  });

  // GET /storage/signed-url/*path — short-lived signed URL for private files
  app.get("/storage/signed-url/*", async (request, reply) => {
    const params = request.params as Record<string, string>;
    const filePath = params["*"];
    if (!filePath) {
      reply.code(400);
      return { error: "path required" };
    }

    const client = options.getServiceClient();
    const { data, error } = await client.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 3600); // 1 hour
    if (error || !data) {
      reply.code(500);
      return { error: `Signed URL failed: ${error?.message ?? "unknown"}` };
    }

    return { signedUrl: data.signedUrl };
  });
}
