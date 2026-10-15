import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsv } from "../modules/catalogue/csv.js";
import { createServiceClient, createUserScopedClient } from "../lib/supabase.js";
import { createSupabaseCatalogueRepository } from "../modules/catalogue/repository.js";
import { importCatalogue } from "../modules/catalogue/service.js";
import type { DispositionRow, RawCatalogueRow } from "../modules/catalogue/types.js";

/**
 * Admin-only CLI, run via `npm run import:catalogue` from backend/ — same
 * "service-role bootstrap step, not a self-service API" precedent as
 * ticket 0055's tenant creation and ticket 0056's first role assignment
 * (DECISIONS.md). 1,308 rows of JSON over an HTTP body with no
 * file-upload UI yet is not a realistic admin workflow at this phase;
 * see ticket 0058.
 *
 * Reads docs/catalogue/source-catalogue.json (regenerate first with
 * `python3 scripts/xlsx_to_json.py` if missing — it's gitignored,
 * ~5.5MB, fully regenerable from the committed xlsx) and
 * docs/catalogue/disposition-workbook.csv (committed).
 */

const REPO_ROOT = resolve(import.meta.dirname, "../../../");
const SOURCE_JSON_PATH = resolve(REPO_ROOT, "docs/catalogue/source-catalogue.json");
const DISPOSITION_CSV_PATH = resolve(REPO_ROOT, "docs/catalogue/disposition-workbook.csv");

function loadRawRows(): RawCatalogueRow[] {
  let parsed: { records: Record<string, unknown>[] };
  try {
    parsed = JSON.parse(readFileSync(SOURCE_JSON_PATH, "utf-8"));
  } catch (error) {
    throw new Error(
      `Could not read ${SOURCE_JSON_PATH} — regenerate it first with ` +
        `"python3 scripts/xlsx_to_json.py" from the repo root (it's gitignored, ~5.5MB, ` +
        `fully regenerable from the committed xlsx). Original error: ${(error as Error).message}`,
    );
  }
  return parsed.records as unknown as RawCatalogueRow[];
}

function loadDispositionRows(): DispositionRow[] {
  const text = readFileSync(DISPOSITION_CSV_PATH, "utf-8");
  return parseCsv(text) as unknown as DispositionRow[];
}

function checksumOf(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

async function main() {
  const rawRows = loadRawRows();
  const dispositionRows = loadDispositionRows();
  const checksum = checksumOf(SOURCE_JSON_PATH);

  const repository = createSupabaseCatalogueRepository(createServiceClient(), createUserScopedClient);
  const result = await importCatalogue(repository, rawRows, dispositionRows, {
    sourceFileName: "source-catalogue.json",
    sourceFileChecksum: checksum,
    importedBy: null,
  });

  console.log(
    `Imported ${result.totalRows} rows: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged.`,
  );
  if (result.issues.length > 0) {
    console.warn(`${result.issues.length} row(s) could not be merged:`);
    for (const issue of result.issues) {
      console.warn(`  S.No. ${issue.source_serial}: ${issue.reason}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
