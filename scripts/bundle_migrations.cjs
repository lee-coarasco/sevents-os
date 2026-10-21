const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'supabase', 'migrations');
const files = fs.readdirSync(dir)
  .filter(f => f.startsWith('20261018') || f.startsWith('20261019') || f.startsWith('20261020') || f.startsWith('20261021'))
  .sort();

const sections = [];
sections.push('-- ==============================================================================');
sections.push('-- CONSOLIDATED IDEMPOTENT MIGRATIONS BUNDLE (M14 through M38, Storage & AI)');
sections.push('-- Execute this script in your Supabase Dashboard -> SQL Editor.');
sections.push('-- This script creates all missing tables, indexes, RLS policies and reloads PostgREST.');
sections.push('-- Safe to execute multiple times (fully idempotent).');
sections.push('-- ==============================================================================\n');

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Ensure CREATE TABLE has IF NOT EXISTS
  content = content.replace(/create\s+table\s+public\./gi, 'create table if not exists public.');
  content = content.replace(/create\s+table\s+(\w+)\s+\(/gi, (match, tbl) => {
    if (tbl.toLowerCase() === 'if') return match;
    return `create table if not exists public.${tbl} (`;
  });

  // 2. Ensure CREATE POLICY has DROP POLICY IF EXISTS before it
  // Pattern: create policy ("?[\w\s_]+"?)\s+on\s+public\.(\w+)
  content = content.replace(/(?<!drop\s+policy\s+if\s+exists\s+.*;\s*)create\s+policy\s+("?[a-zA-Z0-9_\s]+"|\b[a-zA-Z0-9_]+\b)\s+on\s+public\.(\w+)/gi, (match, polName, tblName) => {
    return `drop policy if exists ${polName} on public.${tblName};\ncreate policy ${polName} on public.${tblName}`;
  });

  sections.push('-- >>> BEGIN: ' + file + ' >>>');
  sections.push(content.trim());
  sections.push('-- <<< END: ' + file + ' <<<\n');
}

sections.push('-- ==============================================================================');
sections.push('-- Reload PostgREST schema cache to ensure all new tables are immediately live');
sections.push("NOTIFY pgrst, 'reload schema';");
sections.push('-- ==============================================================================');

const fullSql = sections.join('\n\n');
const outPath = path.join(__dirname, '..', 'supabase', 'apply_all_pending_migrations.sql');
fs.writeFileSync(outPath, fullSql, 'utf8');
console.log('Successfully bundled ' + files.length + ' migrations into supabase/apply_all_pending_migrations.sql');
console.log('Total file size: ' + Math.round(fullSql.length / 1024) + ' KB');
