# Display Masjid - Masjid Agung Raudhatul Dunya

Aplikasi display masjid modern berbasis **HTML + CSS + JS + JSON**.  
Siap di-deploy ke **GitHub Pages** tanpa backend.

## Fitur

- ✅ Jam digital real-time
- ✅ Jadwal sholat akurat (Aladhan API - metode Kemenag)
- ✅ Deteksi lokasi otomatis (geolocation) + fallback Bogor
- ✅ Countdown menuju waktu sholat terdekat
- ✅ Tanggal Hijriah & Masehi
- ✅ Highlight sholat berikutnya
- ✅ Running text pengumuman (dari `data.json`)
- ✅ Rotasi ayat & hadits
- ✅ Desain modern minimalis (White · Gold · Cream)
- ✅ Fully responsive (HP, Tablet, TV, Kiosk)
- ✅ Offline-friendly (setelah data ter-load)

## Cara Deploy ke GitHub Pages

1. Buat repository baru di GitHub
2. Upload semua file di folder ini
3. Settings → Pages → Source: Deploy from branch `main` / `root`
4. Akses via `https://username.github.io/nama-repo`

## Kustomisasi

Edit file **`data.json`** untuk mengubah:

- Nama masjid & lokasi
- Teks berjalan (running text)
- Kumpulan quote / ayat / hadits
- Interval rotasi

## Struktur File

```
├── index.html
├── style.css
├── script.js
├── data.json
└── README.md
```

## Catatan

- Membutuhkan koneksi internet untuk mengambil jadwal sholat (Aladhan API).
- Setelah data ter-load, aplikasi tetap berjalan lancar.
- Metode perhitungan: **Kemenag (method 20)**.

---

Dibuat untuk **Masjid Agung Raudhatul Dunya** – Bogor  
Semoga bermanfaat dan menjadi amal jariyah. 🤲
