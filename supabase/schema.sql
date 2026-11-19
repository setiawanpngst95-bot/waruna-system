-- Waruna System: skema database untuk Supabase (jalankan di SQL Editor)
-- Login memakai Supabase Auth (email + kata sandi), jadi kata sandi tidak disimpan di tabel mana pun.

-- 1. Peran anggota tim (dikelola Founder)
create table if not exists public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null check (role in ('founder', 'pm', 'staf', 'viewer')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now()
);

-- 2. Dokumen data (pengganti db.collection(...).doc(...) yang dipakai aplikasi)
create table if not exists public.docs (
  collection text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

-- 3. Jejak audit (hanya ditambah, tidak bisa diubah atau dihapus)
create table if not exists public.audit (
  id bigint generated always as identity primary key,
  actor uuid references auth.users(id),
  act text not null,
  target text,
  detail text,
  at timestamptz not null default now()
);

-- Fungsi bantu: peran pengguna yang sedang login
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.members where user_id = auth.uid() and status = 'active';
$$;

-- Aktifkan Row Level Security: tanpa aturan, tidak ada yang bisa membaca atau menulis
alter table public.members enable row level security;
alter table public.docs enable row level security;
alter table public.audit enable row level security;

-- Anggota: hanya bisa melihat dirinya sendiri; Founder bisa melihat dan mengubah semua
create policy "members_self_read" on public.members for select
  using (user_id = auth.uid() or public.my_role() = 'founder');
create policy "members_founder_write" on public.members for all
  using (public.my_role() = 'founder') with check (public.my_role() = 'founder');

-- Dokumen: semua anggota aktif bisa membaca
create policy "docs_read" on public.docs for select
  using (public.my_role() is not null);

-- Dokumen: Founder dan PM bisa menulis semua koleksi
create policy "docs_write_pm" on public.docs for all
  using (public.my_role() in ('founder', 'pm'))
  with check (public.my_role() in ('founder', 'pm'));

-- Dokumen: Staf hanya bisa menulis transaksi dan permintaan yang dibuatnya sendiri
create policy "docs_write_staf_insert" on public.docs for insert
  with check (public.my_role() = 'staf' and collection in ('transactions', 'requests') and created_by = auth.uid());
create policy "docs_write_staf_update" on public.docs for update
  using (public.my_role() = 'staf' and collection in ('transactions', 'requests') and created_by = auth.uid())
  with check (public.my_role() = 'staf' and collection in ('transactions', 'requests') and created_by = auth.uid());

-- Audit: semua anggota aktif bisa membaca; hanya bisa menambah, tidak ada update atau delete
create policy "audit_read" on public.audit for select
  using (public.my_role() is not null);
create policy "audit_insert" on public.audit for insert
  with check (public.my_role() is not null and actor = auth.uid());

-- Catatan: Founder pertama didaftarkan manual setelah akunnya dibuat di Authentication -> Users.
-- Ganti EMAIL_FOUNDER dan UUID_FOUNDER dengan data Anda, lalu jalankan:
-- insert into public.members (user_id, email, name, role)
-- values ('UUID_FOUNDER', 'EMAIL_FOUNDER', 'Nama Founder', 'founder');
