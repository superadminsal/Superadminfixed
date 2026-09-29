# SUPER ADMIN SAL

Aplikasi web lead time laporan deliveryman untuk Distribution Center. Data tersimpan di Google Sheets. Otak aturan ada di Google Apps Script.

## Alur

1. Deliveryman buka tautan dari barcode Security, masuk dengan No. Polisi + No. FO. Waktu masuk = kolom TIMESTAMP.
2. Deliveryman scan barcode dinding pos (`TRANSPORT_ANTRIAN`, `FG_ANTRIAN`, `BS_ANTRIAN`, `KASIR_ANTRIAN`).
3. Petugas pos masuk dengan NIK + PIN (sheet `NIK_AKSES`) lalu scan barcode HP supir `NOPOL|NOFO|POS|STATUS`.
4. Transport adalah control tower: semua pos, penugasan Ada / Tidak ada / Pending, dan pengaturan URL Apps Script.

## Sheet

File Google Sheets (contoh nama `LEADTIME_APP`) berisi:

| Tab | Isi |
|---|---|
| `MONITORING_LEADTIME` | Trip dan cap waktu |
| `MASTER_EQUIPMENT` | Nopol, mobil, vendor, WA |
| `OPERATING_HOURS` | Jam buka pos |
| `NIK_AKSES` | NIK, NAMA, POS, PIN |

Kolom POS di `NIK_AKSES`: `TRANSPORT` / `FG` / `BS` / `KASIR`.

## Hubungkan Google Sheet

1. Buka file Sheets → **Ekstensi → Apps Script**.
2. Tempel isi `apps-script/Code.gs`.
3. **Deploy → Aplikasi web**
   - Jalankan sebagai: akun Anda
   - Siapa yang memiliki akses: **Siapa saja**
4. Salin URL `/exec`.
5. Login sebagai Transport di aplikasi → **Pengaturan** → tempel URL → Simpan.

## Menjalankan aplikasi

```bash
npm install
npm run dev
```

Bangun produksi:

```bash
npm run build
```

## Struktur

```
apps-script/Code.gs          Otak aturan Google Sheets
src/routes/                  Halaman beranda, deliveryman, petugas
src/components/leadtime/     Antrean, pemindai, QR, rekap, pengaturan
src/lib/leadtime/            Aturan bisnis, API server, tema pos
src/styles.css               Warna pastel per pos
```

Warna pos: Transport kuning, FG biru, BS hijau, Kasir pink.


## Troubleshooting HTTP 401 dari Apps Script

Jika aplikasi menampilkan `Apps Script tidak mengembalikan JSON. Status 401` dan isi respons berupa HTML login Google, masalahnya ada pada izin deployment Apps Script, bukan pada QR atau halaman Vercel.

Buka Apps Script → **Deploy → Manage deployments** → edit deployment Web app. Pastikan:
- **Execute as:** Me / pemilik script
- **Who has access:** Anyone / siapa saja, termasuk pengguna yang tidak login Google
- gunakan URL deployment yang berakhiran `/exec`, bukan `/dev`

Setelah mengubah izin, deploy versi baru dan masukkan kembali URL `/exec` di Pengaturan Transport.

## Konfigurasi Vercel

`data/leadtime-config.json` sekarang menyimpan default URL Apps Script sehingga URL tidak hilang saat instance Vercel diganti. Untuk override tanpa mengubah source code, set environment variable `APPS_SCRIPT_URL` di Vercel dan redeploy.

Catatan: penyimpanan file lokal/runtime di Vercel bukan database permanen. Data aplikasi tetap sebaiknya berasal dari Google Sheets.
