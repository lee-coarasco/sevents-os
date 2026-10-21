-- Migration: 20261021000001_storage_bucket_attachments.sql
-- Ensure the storage bucket 'attachments' exists and is publicly readable

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', true, 52428800, null)
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800;

-- RLS policies on storage.objects for the attachments bucket
do $$
begin
  -- Policy: allow authenticated users to select objects in attachments
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated users can read attachments'
  ) then
    create policy "Authenticated users can read attachments"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'attachments');
  end if;

  -- Policy: allow public to read attachments
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public can read attachments'
  ) then
    create policy "Public can read attachments"
    on storage.objects for select
    to public
    using (bucket_id = 'attachments');
  end if;

  -- Policy: allow authenticated users to upload to attachments
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated users can upload attachments'
  ) then
    create policy "Authenticated users can upload attachments"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'attachments');
  end if;

  -- Policy: allow authenticated users to update their attachments
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated users can update attachments'
  ) then
    create policy "Authenticated users can update attachments"
    on storage.objects for update
    to authenticated
    using (bucket_id = 'attachments');
  end if;

  -- Policy: allow authenticated users to delete attachments
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated users can delete attachments'
  ) then
    create policy "Authenticated users can delete attachments"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'attachments');
  end if;
end
$$;
