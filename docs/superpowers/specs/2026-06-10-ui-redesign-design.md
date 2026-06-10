# Cashflow UI Redesign — "Graphite Mint"

**Tanggal:** 2026-06-10
**Status:** Disetujui (brainstorming selesai)
**Cakupan:** Seluruh aplikasi — semua tab, modal, auth screen, mobile. Dark-only. Rebrand lembut total (semua kosmetik terminal dilepas).

## Latar belakang

Desain saat ini ("Terminal × Editorial" v2.6) memakai IBM Plex Mono + Fraunces, hitam pekat, satu warna sinyal oranye, dan kosmetik terminal (ticker bar, OPS.MENU, tag versi, label uppercase). Pengguna ingin arah **modern & lembut** bergaya fintech premium. Dari tiga arah yang dimockup (Soft Indigo, Warm Calm, Graphite Mint), pengguna memilih **Graphite Mint** dengan satu revisi: kartu memakai border solid yang terlihat jelas (seperti arah Soft Indigo).

## 1. Fondasi — token desain

### Warna (dark-only)

| Token | Nilai | Peran |
|---|---|---|
| `--bg` | `#0e1211` | Latar utama — graphite undertone hijau |
| `--surface` | `#161c1a` | Kartu & panel |
| `--surface-2` | `#1c2421` | Input, hover, chip, elemen di atas kartu |
| `--ink` | `#e9efec` | Teks utama |
| `--ink-dim` | `rgba(233,239,236,.60)` | Label, teks sekunder |
| `--ink-faint` | `rgba(233,239,236,.38)` | Meta, placeholder |
| `--accent` | `#3ddc97` | Mint — CTA, tab aktif, highlight brand |
| `--accent-tint` | `rgba(61,220,151,.12)` | Latar ikon/chip aksen |
| `--pos` | `#4ade80` | Pemasukan / positif |
| `--neg` | `#f47171` | Pengeluaran / negatif (salmon lembut) |
| `--warn` | `#e8c468` | Peringatan budget |
| `--rule` | `#26302c` | Border solid 1px kartu/input — TERLIHAT jelas |
| `--rule-strong` | `#33403a` | Border hover/focus |

Aturan: mint hanya untuk identitas & aksi; data uang memakai pos/neg; tidak ada warna lain di chrome.

### Tipografi

- UI & body: **DM Sans** (Google Fonts), menggantikan IBM Plex Mono.
- Angka uang: DM Sans + `font-variant-numeric: tabular-nums`.
- IBM Plex Mono dan Fraunces dilepas total.
- Skala: base 13px · label/meta 11px · judul kartu 15px · angka hero 26–32px.
- Tanpa uppercase-tracking gaya terminal; sentence case biasa.

### Bentuk & kedalaman

- Radius: kartu 12px · input/tombol 8px · chip/filter pill 99px · modal 16px.
- Kartu: `background: var(--surface); border: 1px solid var(--rule)`. Tanpa drop-shadow berat; kedalaman dari tingkatan surface.
- Spacing: padding kartu 16–20px, gap grid 12px.

## 2. Shell & navigasi

### Dihapus (rebrand lembut)

- Ticker bar atas — data MTD/FX pindah menjadi kartu di dashboard.
- "OPS.MENU", nomor tab `01/02`, tag `[v2.6]`, label uppercase-mono.
- Eyebrow auth "Ledger Terminal / SECURE CHANNEL".

### Struktur baru

- **Wordmark:** "Cashflow" + logo.svg disesuaikan warna mint.
- **Desktop:** sidebar kiri — item nav ikon + label; item aktif: latar `--surface-2` + teks mint. Bawah sidebar: info akun + logout.
- **Header halaman:** heading besar per tab + sub-teks (periode aktif, jumlah txn) + aksi utama kanan (mis. "+ Transaksi", tombol mint solid).
- **Mobile:** bottom tab bar 5 slot (Dashboard, Transaksi, **+** di tengah untuk quick-add, Budget, Goals) menggantikan sidebar overlay.
- **Auth:** kartu tengah — logo, "Masuk ke Cashflow", tombol Google bersih.

## 3. Komponen inti

- **Tombol:** primer mint solid (teks `#0e1211`); sekunder surface + border; destruktif salmon outline. Radius 8px, tinggi 36px.
- **Input:** latar `--surface-2`, border `--rule`, focus ring mint.
- **Modal:** kartu radius 16px, backdrop blur tipis, aksi kanan-bawah.
- **Baris transaksi:** ikon kategori berlatar tint, nama + meta 2 baris, nominal kanan pos/neg, hover `--surface-2`, pemisah hairline.
- **Chip/filter:** pill; aktif = mint-tint + teks mint.
- **Badge:** pill kecil tint (mis. "▲ 12,4%").

## 4. Per layar

- **Dashboard:** hero "Saldo bulan ini" (angka besar + delta badge) · kartu Pemasukan/Pengeluaran dengan mini-bar · chart cashflow utama · transaksi terakhir · kartu ringkas budget & goals · kartu FX USD·IDR (pengganti ticker).
- **Transaksi:** toolbar filter pill (periode, kategori, akun, cari) · tabel dengan grouping per tanggal + subtotal harian.
- **Budget:** kartu per kategori, progress bar mint → kuning (`--warn`) → salmon saat melewati batas, nominal terpakai/limit.
- **Goals:** kartu goal dengan progress mint, target & ETA, milestone checklist.
- **Laporan:** kartu chart + periode picker pill; ekspor PDF tetap berfungsi.
- **Empty state:** semua layar — ikon + satu kalimat + tombol aksi.

## 5. Chart & motion

- Chart.js: garis/area mint dengan fill gradien tipis → transparan; grid `--rule`; tooltip kartu gelap rounded; donut kategori memakai tangga mint → teal → kuning → salmon (bukan rainbow).
- Motion: 150–200ms ease-out untuk hover/focus; fade+slide kecil antar tab; progress bar animate saat mount; hormati `prefers-reduced-motion`.

## 6. Strategi implementasi

1. Checkpoint: commit/simpan state working tree saat ini sebelum mulai.
2. Tulis ulang `public/styles/styles.css` bersih dengan sistem token baru (bukan menambal 5.600 baris yang ada).
3. Migrasi layar per layar, dashboard lebih dulu.
4. Hapus `public/styles/cashflow-override.css` (patch lama); rapikan `mobile.css` untuk bottom tab bar.
5. Sesuaikan `public/index.html`: ticker dibuang, bottom tab bar masuk, font link diganti DM Sans.
6. Sesuaikan i18n (`src/i18n/en.js`, `src/i18n/id.js`): hapus/ganti string bergaya terminal.
7. Sesuaikan `src/ui/components/charts.js` ke token warna baru.
8. Hapus 4 halaman eksperimen `public/*-compare.html`.

## 7. Verifikasi

- Preview browser desktop + mobile (375px): semua tab, modal, chart, auth screen.
- Cek kontras teks (ink-dim di atas surface ≥ 4.5:1 untuk teks penting).
- Chart render benar dengan token baru; ekspor PDF tidak rusak.
- `prefers-reduced-motion` mematikan animasi.

## Keputusan tercatat

- Modern & lembut, seluruh aplikasi, **dark-only**, rebrand lembut total.
- Arah visual: **Graphite Mint** + border kartu terlihat (revisi dari mockup A).
- Mobile memakai bottom tab bar, bukan sidebar overlay.
- Mono/serif fonts dilepas; satu keluarga font (DM Sans).
