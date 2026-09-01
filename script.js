/**
 * Masjid Agung Raudhatul Dunya - Display Masjid
 * Pure HTML/CSS/JS + JSON | GitHub Pages ready
 */

const PRAYER_ORDER = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const PRAYER_LABELS = {
  Fajr: 'Subuh',
  Sunrise: 'Syuruq',
  Dhuhr: 'Dzuhur',
  Asr: 'Ashar',
  Maghrib: 'Maghrib',
  Isha: 'Isya'
};

let config = null;
let prayerTimes = {};
let nextPrayer = null;
let quoteIndex = 0;
let runningIndex = 0;

// ========== INIT ==========
async function init() {
  try {
    const res = await fetch('data.json');
    config = await res.json();
  } catch (e) {
    console.warn('Gagal load data.json, pakai default');
    config = getDefaultConfig();
  }

  applyConfig();
  startClock();
  await loadPrayerTimes();
  startQuoteRotation();
  startRunningTextRotation();

  document.getElementById('loading').classList.add('hide');
}

function getDefaultConfig() {
  return {
    mosque: {
      name: 'Masjid Agung Raudhatul Dunya',
      location: 'Bogor, Jawa Barat',
      fallbackLat: -6.5971,
      fallbackLng: 106.8060
    },
    runningTexts: ['Selamat datang di Masjid Agung Raudhatul Dunya'],
    quotes: [{ text: 'Dirikanlah sholat...', source: 'Al-Qur\'an' }],
    settings: { method: 20, quoteIntervalSeconds: 45 }
  };
}

function applyConfig() {
  document.getElementById('mosque-name').textContent = config.mosque.name;
  document.getElementById('mosque-location').textContent = config.mosque.location;
}

// ========== CLOCK ==========
function startClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('clock').textContent = `${h}:${m}:${s}`;

  // Update countdown every second
  updateCountdown();
}

// ========== PRAYER TIMES ==========
async function loadPrayerTimes() {
  let lat = config.mosque.fallbackLat;
  let lng = config.mosque.fallbackLng;

  // Try geolocation
  try {
    const pos = await getPosition();
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
    console.log('Lokasi terdeteksi:', lat, lng);
  } catch (e) {
    console.warn('Geolocation gagal, pakai fallback Bogor');
  }

  try {
    const method = config.settings?.method || 20; // 20 = Kemenag
    const url = `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lng}&method=${method}&school=0`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.code === 200) {
      const t = data.data.timings;
      prayerTimes = {
        Fajr: t.Fajr,
        Sunrise: t.Sunrise,
        Dhuhr: t.Dhuhr,
        Asr: t.Asr,
        Maghrib: t.Maghrib,
        Isha: t.Isha
      };

      // Hijri date
      const hijri = data.data.date.hijri;
      const greg = data.data.date.gregorian;
      document.getElementById('hijri-date').textContent =
        `${hijri.day} ${hijri.month.en} ${hijri.year} H`;
      document.getElementById('gregorian-date').textContent =
        formatGregorian(greg);

      renderPrayerTimes();
      determineNextPrayer();
    } else {
      throw new Error('API error');
    }
  } catch (err) {
    console.error('Gagal ambil jadwal sholat:', err);
    // Fallback hardcoded approximate for Bogor (example)
    setFallbackTimes();
  }
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 8000,
      maximumAge: 600000
    });
  });
}

function setFallbackTimes() {
  // Approximate times (will be replaced when online)
  prayerTimes = {
    Fajr: '04:35',
    Sunrise: '05:52',
    Dhuhr: '12:00',
    Asr: '15:20',
    Maghrib: '18:05',
    Isha: '19:15'
  };
  renderPrayerTimes();
  determineNextPrayer();
  document.getElementById('gregorian-date').textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function formatGregorian(g) {
  const months = {
    '01': 'Januari', '02': 'Februari', '03': 'Maret', '04': 'April',
    '05': 'Mei', '06': 'Juni', '07': 'Juli', '08': 'Agustus',
    '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember'
  };
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const d = new Date(`${g.year}-${g.month.number}-${g.day}`);
  const dayName = days[d.getDay()];
  return `${dayName}, ${g.day} ${months[g.month.number] || g.month.en} ${g.year}`;
}

function renderPrayerTimes() {
  PRAYER_ORDER.forEach(key => {
    const el = document.getElementById(`time-${key}`);
    if (el && prayerTimes[key]) {
      el.textContent = prayerTimes[key].substring(0, 5); // HH:MM
    }
  });
}

function determineNextPrayer() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let found = null;
  for (const key of PRAYER_ORDER) {
    if (key === 'Sunrise') continue; // skip Syuruq for "next prayer" focus
    const [h, m] = prayerTimes[key].split(':').map(Number);
    const prayerMin = h * 60 + m;
    if (prayerMin > currentMinutes) {
      found = { key, time: prayerTimes[key], minutes: prayerMin };
      break;
    }
  }

  // If none left today, next is Fajr tomorrow
  if (!found) {
    const [h, m] = prayerTimes.Fajr.split(':').map(Number);
    found = {
      key: 'Fajr',
      time: prayerTimes.Fajr,
      minutes: h * 60 + m + 24 * 60
    };
  }

  nextPrayer = found;
  document.getElementById('next-prayer-name').textContent = PRAYER_LABELS[found.key];
  document.getElementById('next-prayer-time').textContent = `pukul ${found.time.substring(0, 5)}`;

  // Highlight active card
  document.querySelectorAll('.prayer-card').forEach(card => {
    card.classList.toggle('active', card.dataset.prayer === found.key);
  });
}

function updateCountdown() {
  if (!nextPrayer) return;

  const now = new Date();
  const currentTotalSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  let [h, m] = nextPrayer.time.split(':').map(Number);
  let targetSec = h * 3600 + m * 60;

  // If next is tomorrow Fajr
  if (nextPrayer.minutes >= 24 * 60) {
    targetSec += 24 * 3600;
  }

  let diff = targetSec - currentTotalSec;
  if (diff < 0) {
    // Recalculate next prayer
    determineNextPrayer();
    return;
  }

  const hh = String(Math.floor(diff / 3600)).padStart(2, '0');
  const mm = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
  const ss = String(diff % 60).padStart(2, '0');

  document.getElementById('countdown').textContent = `${hh}:${mm}:${ss}`;
}

// ========== QUOTES ==========
function startQuoteRotation() {
  showQuote();
  const interval = (config.settings?.quoteIntervalSeconds || 45) * 1000;
  setInterval(() => {
    quoteIndex = (quoteIndex + 1) % config.quotes.length;
    showQuote();
  }, interval);
}

function showQuote() {
  const q = config.quotes[quoteIndex];
  const textEl = document.getElementById('quote-text');
  const sourceEl = document.getElementById('quote-source');

  textEl.style.opacity = 0;
  sourceEl.style.opacity = 0;

  setTimeout(() => {
    textEl.textContent = q.text;
    sourceEl.textContent = q.source || '';
    textEl.style.opacity = 1;
    sourceEl.style.opacity = 1;
  }, 300);
}

// ========== RUNNING TEXT ==========
function startRunningTextRotation() {
  // Initial set
  updateRunningText();

  // Rotate every full cycle roughly
  setInterval(() => {
    runningIndex = (runningIndex + 1) % config.runningTexts.length;
    updateRunningText();
  }, 30000);
}

function updateRunningText() {
  const el = document.getElementById('running-text');
  el.textContent = config.runningTexts[runningIndex] + '   •   ' + config.runningTexts[(runningIndex + 1) % config.runningTexts.length];
}

// ========== START ==========
document.addEventListener('DOMContentLoaded', init);

// Refresh prayer times every 6 hours & at midnight
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() < 5) {
    loadPrayerTimes();
  }
}, 5 * 60 * 1000);

// Also refresh once after 10 min in case of late load
setTimeout(loadPrayerTimes, 10 * 60 * 1000);
