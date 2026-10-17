import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { MasterDataRepository } from "./repository.js";
import {
  CostCodeInUseError,
  DocumentTypeInUseError,
  NotFoundError,
  NumberingSchemeNotActiveError,
  archiveCostCode,
  archiveCurrency,
  archiveDocumentType,
  archiveUom,
  createCostCode,
  createCurrency,
  createDocumentType,
  createNumberingScheme,
  createUom,
  issueNextNumber,
  listCostCodes,
  listCurrencies,
  listDocumentTypes,
  listNumberingSchemes,
  listUom,
  previewNextNumber,
  updateCostCode,
  updateCurrency,
  updateDocumentType,
  updateNumberingScheme,
  updateUom,
} from "./service.js";
import type {
  CreateCostCodeInput,
  CreateCurrencyInput,
  CreateDocumentTypeInput,
  CreateNumberingSchemeInput,
  CreateUomInput,
  UpdateCostCodeInput,
  UpdateCurrencyInput,
  UpdateDocumentTypeInput,
  UpdateNumberingSchemeInput,
  UpdateUomInput,
} from "./repository.js";

export interface MasterDataRouteOptions {
  getRepository: () => MasterDataRepository;
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function masterDataRoutes(app: FastifyInstance, options: MasterDataRouteOptions) {
  const manage = { preHandler: options.requirePermission("master-data.manage") };

  // --- UoM ---

  app.get("/master-data/uom", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const uom = await listUom(options.getRepository(), token);
    return { uom };
  });

  app.post<{ Body: CreateUomInput }>("/master-data/uom", manage, async (request, reply) => {
    const { code, description } = request.body ?? ({} as never);
    if (!code) {
      reply.code(400);
      return { error: "code is required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const created = await createUom(options.getRepository(), token, { code, description: description ?? null });
    reply.code(201);
    return { uom: created };
  });

  app.patch<{ Params: { id: string }; Body: UpdateUomInput }>(
    "/master-data/uom/:id",
    manage,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const updated = await updateUom(options.getRepository(), token, request.params.id, request.body ?? {});
        return { uom: updated };
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404);
          return { error: "uom not found" };
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { id: string } }>("/master-data/uom/:id/archive", manage, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const archived = await archiveUom(options.getRepository(), token, request.params.id);
      return { uom: archived };
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: "uom not found" };
      }
      throw error;
    }
  });

  // --- Currencies ---

  app.get("/master-data/currencies", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const currencies = await listCurrencies(options.getRepository(), token);
    return { currencies };
  });

  app.post<{ Body: CreateCurrencyInput }>("/master-data/currencies", manage, async (request, reply) => {
    const { code, name } = request.body ?? ({} as never);
    if (!code || !name) {
      reply.code(400);
      return { error: "code and name are required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const created = await createCurrency(options.getRepository(), token, request.body);
    reply.code(201);
    return { currency: created };
  });

  app.patch<{ Params: { id: string }; Body: UpdateCurrencyInput }>(
    "/master-data/currencies/:id",
    manage,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const updated = await updateCurrency(options.getRepository(), token, request.params.id, request.body ?? {});
        return { currency: updated };
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404);
          return { error: "currency not found" };
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { id: string } }>("/master-data/currencies/:id/archive", manage, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const archived = await archiveCurrency(options.getRepository(), token, request.params.id);
      return { currency: archived };
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: "currency not found" };
      }
      throw error;
    }
  });

  // --- Cost codes ---

  app.get("/master-data/cost-codes", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const costCodes = await listCostCodes(options.getRepository(), token);
    return { costCodes };
  });

  app.post<{ Body: CreateCostCodeInput }>("/master-data/cost-codes", manage, async (request, reply) => {
    const { code, category } = request.body ?? ({} as never);
    if (!code || !category) {
      reply.code(400);
      return { error: "code and category are required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const created = await createCostCode(options.getRepository(), token, request.body);
    reply.code(201);
    return { costCode: created };
  });

  app.patch<{ Params: { id: string }; Body: UpdateCostCodeInput }>(
    "/master-data/cost-codes/:id",
    manage,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const updated = await updateCostCode(options.getRepository(), token, request.params.id, request.body ?? {});
        return { costCode: updated };
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404);
          return { error: "cost code not found" };
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { id: string } }>("/master-data/cost-codes/:id/archive", manage, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const archived = await archiveCostCode(options.getRepository(), token, request.params.id);
      return { costCode: archived };
    } catch (error) {
      if (error instanceof CostCodeInUseError) {
        reply.code(409);
        return { error: error.message, referencingCount: error.referencingCount };
      }
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: "cost code not found" };
      }
      throw error;
    }
  });

  // --- Document types ---

  app.get("/master-data/document-types", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const documentTypes = await listDocumentTypes(options.getRepository(), token);
    return { documentTypes };
  });

  app.post<{ Body: CreateDocumentTypeInput }>("/master-data/document-types", manage, async (request, reply) => {
    const { code, label } = request.body ?? ({} as never);
    if (!code || !label) {
      reply.code(400);
      return { error: "code and label are required" };
    }
    const token = bearerToken(request.headers.authorization) as string;
    const created = await createDocumentType(options.getRepository(), token, { code, label });
    reply.code(201);
    return { documentType: created };
  });

  app.patch<{ Params: { id: string }; Body: UpdateDocumentTypeInput }>(
    "/master-data/document-types/:id",
    manage,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const updated = await updateDocumentType(
          options.getRepository(),
          token,
          request.params.id,
          request.body ?? {},
        );
        return { documentType: updated };
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404);
          return { error: "document type not found" };
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/master-data/document-types/:id/archive",
    manage,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const archived = await archiveDocumentType(options.getRepository(), token, request.params.id);
        return { documentType: archived };
      } catch (error) {
        if (error instanceof DocumentTypeInUseError) {
          reply.code(409);
          return { error: error.message, referencingCount: error.referencingCount };
        }
        if (error instanceof NotFoundError) {
          reply.code(404);
          return { error: "document type not found" };
        }
        throw error;
      }
    },
  );

  // --- Numbering schemes ---

  app.get("/master-data/numbering-schemes", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const numberingSchemes = await listNumberingSchemes(options.getRepository(), token);
    return { numberingSchemes };
  });

  app.post<{ Body: CreateNumberingSchemeInput }>(
    "/master-data/numbering-schemes",
    manage,
    async (request, reply) => {
      const { entity_type } = request.body ?? ({} as never);
      if (!entity_type) {
        reply.code(400);
        return { error: "entity_type is required" };
      }
      const token = bearerToken(request.headers.authorization) as string;
      const created = await createNumberingScheme(options.getRepository(), token, request.body);
      reply.code(201);
      return { numberingScheme: created };
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateNumberingSchemeInput }>(
    "/master-data/numbering-schemes/:id",
    manage,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const updated = await updateNumberingScheme(
          options.getRepository(),
          token,
          request.params.id,
          request.body ?? {},
        );
        return { numberingScheme: updated };
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404);
          return { error: "numbering scheme not found" };
        }
        throw error;
      }
    },
  );

  app.get<{ Params: { id: string } }>("/master-data/numbering-schemes/:id/preview", async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const formatted = await previewNextNumber(options.getRepository(), token, request.params.id);
      return { formatted };
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404);
        return { error: "numbering scheme not found" };
      }
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>(
    "/master-data/numbering-schemes/:id/next",
    manage,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const { scheme, formatted } = await issueNextNumber(options.getRepository(), token, request.params.id);
        return { numberingScheme: scheme, formatted };
      } catch (error) {
        if (error instanceof NumberingSchemeNotActiveError) {
          reply.code(409);
          return { error: error.message };
        }
        if (error instanceof NotFoundError) {
          reply.code(404);
          return { error: "numbering scheme not found" };
        }
        throw error;
      }
    },
  );
}
