-- Semua anggota aktif boleh melihat daftar anggota (nama dan peran), agar nama pembuat data tampil.
drop policy if exists "members_self_read" on public.members;
drop policy if exists "members_read_active" on public.members;
create policy "members_read_active" on public.members for select
  using (user_id = auth.uid() or public.my_role() is not null);
