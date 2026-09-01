# Display Masjid v2 — Masjid Agung Raudhatul Dunya

Aplikasi display masjid modern berbasis **HTML + CSS + JS + JSON**.  
Siap di-deploy ke **GitHub Pages**.

## Fitur Lengkap

| Fitur | Keterangan |
|-------|----------|
| Jam Digital | Real-time |
| Jadwal Sholat | Akurat via Aladhan API (metode Kemenag) |
| Geolocation | Deteksi lokasi otomatis + fallback Bogor |
| Countdown | Menuju waktu sholat terdekat |
| **Suara Adzan** | Otomatis play saat masuk waktu sholat |
| **Mode Iqamah** | Countdown penuh layar setelah adzan |
| **Slide Gambar** | Rotasi gambar + caption |
| Tanggal Hijriah & Masehi | Otomatis |
| Running Text | Pengumuman berjalan |
| Quote / Ayat | Rotasi otomatis |
| Desain | Modern minimalis (White · Gold · Cream) |
| Responsive | HP, Tablet, TV, Kiosk |

## Cara Deploy ke GitHub Pages

1. Buat repository baru
2. Upload semua file
3. Settings → Pages → Source: `main` / root
4. Buka URL GitHub Pages

## Kustomisasi (`data.json`)

### Suara Adzan
```json
"adhanAudio": "https://cdn.aladhan.com/audio/adhans/a1.mp3",
"enableAdhanSound": true
```

### Durasi Iqamah (menit)
```json
"iqamahMinutes": {
  "Fajr": 15,
  "Dhuhr": 12,
  "Asr": 12,
  "Maghrib": 8,
  "Isha": 12
}
```

### Slide Gambar
```json
"slides": [
  {
    "image": "images/foto1.jpg",
    "caption": "Kegiatan kajian rutin"
  }
]
```
Ganti URL Unsplash dengan file lokal (buat folder `images/`).

## Catatan Penting

- Browser modern sering memblokir autoplay audio sampai ada interaksi user.  
  Solusi: klik sekali di layar saat pertama kali dibuka.
- Untuk produksi, download file adzan MP3 dan taruh lokal.
- Metode perhitungan: **Kemenag (method 20)**.

---

Dibuat untuk **Masjid Agung Raudhatul Dunya** – Bogor  
Semoga menjadi amal jariyah. 🤲
