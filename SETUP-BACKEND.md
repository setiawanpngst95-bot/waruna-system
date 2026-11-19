# Waruna System: pengaturan backend (Supabase)

Dokumen ini untuk langkah yang harus dilakukan pemilik akun. Kode aplikasi belum diubah di sini.

## 1. Buat proyek Supabase
1. Daftar di supabase.com (paket gratis).
2. Buat proyek baru, misalnya `waruna-system`. Simpan kata sandi database di tempat aman.
3. Buka **SQL Editor**, tempelkan isi `supabase/schema.sql`, lalu jalankan.
4. Buka **Authentication → Providers**, pastikan Email aktif. Matikan **Allow new users to sign up** agar tidak ada orang asing yang mendaftar sendiri.
5. Buka **Authentication → Users**, tekan **Add user → Create new user**, isi email dan kata sandi Founder. Salin **UUID** akun itu.
6. Di SQL Editor, jalankan perintah `insert into public.members ...` yang ada di bagian bawah `schema.sql`, dengan UUID dan email Founder.
7. Ulangi langkah 5 dan 6 untuk setiap anggota tim, dengan peran `pm`, `staf`, atau `viewer`.

## 2. Ambil kunci proyek
Buka **Project Settings → API**. Salin:
- **Project URL**
- **anon public key**

Jangan bagikan **service_role key** ke siapa pun, termasuk ke chat ini.

## 3. Repositori dan hosting
1. Buat repositori GitHub kosong, misalnya `waruna-system`.
2. Buat akun Netlify atau Cloudflare Pages (gratis) dan hubungkan ke repositori.
3. Hosting memberi subdomain gratis. Domain sendiri tidak wajib.

## Keamanan yang sudah dirancang
- Kata sandi diurus oleh Supabase Auth, tidak disimpan di kode atau tabel.
- Akses data diatur di server dengan Row Level Security sesuai peran.
- Jejak audit hanya bisa ditambah, tidak bisa diubah atau dihapus.
- Pendaftaran mandiri dimatikan, sehingga hanya akun yang Anda buat yang bisa masuk.

## Yang belum dikerjakan
- Menghubungkan halaman aplikasi ke Supabase (mengganti penyimpanan artifact).
- Migrasi data. Data simulasi sudah dihapus, jadi mulai dari kosong.
- Pengujian di browser sebelum rilis.

Setelah langkah 1 sampai 3 selesai, kirimkan URL proyek, anon key, dan nama repositori ke saya.
