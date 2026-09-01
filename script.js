/**
 * Masjid Agung Raudhatul Dunya - Display Masjid v2
 * Features: Adhan Sound · Iqamah Mode · Image Slider
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
let slideIndex = 0;
let currentMode = 'normal'; // normal | adhan | iqamah
let iqamahEndTime = null;
let adhanPlayedFor = null;

// ========== INIT ==========
async function init() {
  try {
    const res = await fetch('data.json');
    config = await res.json();
  } catch (e) {
    console.warn('Gagal load data.json');
    config = getDefaultConfig();
  }

  applyConfig();
  initSlider();
  startClock();
  await loadPrayerTimes();
  startQuoteRotation();
  startRunningTextRotation();
  startSlideRotation();

  const audio = document.getElementById('adhan-audio');
  if (config.settings?.adhanAudio) {
    audio.src = config.settings.adhanAudio;
  }

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
    quotes: [{ text: 'Dirikanlah sholat...', source: "Al-Qur'an" }],
    slides: [],
    settings: {
      method: 20,
      quoteIntervalSeconds: 40,
      slideIntervalSeconds: 12,
      iqamahMinutes: { Fajr: 15, Dhuhr: 12, Asr: 12, Maghrib: 8, Isha: 12 },
      enableAdhanSound: true,
      enableIqamahMode: true
    }
  };
}

function applyConfig() {
  document.getElementById('mosque-name').textContent = config.mosque.name;
  document.getElementById('mosque-location').textContent = config.mosque.location;
}

// ========== CLOCK & MODE CHECK ==========
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

  checkPrayerEvents();
  updateCountdown();
  updateIqamahCountdown();
}

// ========== PRAYER TIMES ==========
async function loadPrayerTimes() {
  let lat = config.mosque.fallbackLat;
  let lng = config.mosque.fallbackLng;

  try {
    const pos = await getPosition();
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
  } catch (e) {
    console.warn('Geolocation gagal, pakai Bogor');
  }

  try {
    const method = config.settings?.method || 20;
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

      const hijri = data.data.date.hijri;
      const greg = data.data.date.gregorian;
      document.getElementById('hijri-date').textContent =
        `${hijri.day} ${hijri.month.en} ${hijri.year} H`;
      document.getElementById('gregorian-date').textContent = formatGregorian(greg);

      renderPrayerTimes();
      determineNextPrayer();
    } else {
      throw new Error('API error');
    }
  } catch (err) {
    console.error(err);
    setFallbackTimes();
  }
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject();
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 8000,
      maximumAge: 600000
    });
  });
}

function setFallbackTimes() {
  prayerTimes = {
    Fajr: '04:35', Sunrise: '05:52', Dhuhr: '12:00',
    Asr: '15:20', Maghrib: '18:05', Isha: '19:15'
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
  return `${days[d.getDay()]}, ${g.day} ${months[g.month.number] || g.month.en} ${g.year}`;
}

function renderPrayerTimes() {
  PRAYER_ORDER.forEach(key => {
    const el = document.getElementById(`time-${key}`);
    if (el && prayerTimes[key]) {
      el.textContent = prayerTimes[key].substring(0, 5);
    }
  });
}

function determineNextPrayer() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let found = null;
  for (const key of PRAYER_ORDER) {
    if (key === 'Sunrise') continue;
    const [h, m] = prayerTimes[key].split(':').map(Number);
    const prayerMin = h * 60 + m;
    if (prayerMin > currentMinutes) {
      found = { key, time: prayerTimes[key], minutes: prayerMin };
      break;
    }
  }

  if (!found) {
    const [h, m] = prayerTimes.Fajr.split(':').map(Number);
    found = { key: 'Fajr', time: prayerTimes.Fajr, minutes: h * 60 + m + 24 * 60 };
  }

  nextPrayer = found;
  document.getElementById('next-prayer-name').textContent = PRAYER_LABELS[found.key];
  document.getElementById('next-prayer-time').textContent = `pukul ${found.time.substring(0, 5)}`;

  document.querySelectorAll('.prayer-card').forEach(card => {
    card.classList.toggle('active', card.dataset.prayer === found.key);
  });
}

function updateCountdown() {
  if (!nextPrayer || currentMode !== 'normal') return;

  const now = new Date();
  const currentTotalSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  let [h, m] = nextPrayer.time.split(':').map(Number);
  let targetSec = h * 3600 + m * 60;
  if (nextPrayer.minutes >= 24 * 60) targetSec += 24 * 3600;

  let diff = targetSec - currentTotalSec;
  if (diff < 0) {
    determineNextPrayer();
    return;
  }

  const hh = String(Math.floor(diff / 3600)).padStart(2, '0');
  const mm = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
  const ss = String(diff % 60).padStart(2, '0');
  document.getElementById('countdown').textContent = `${hh}:${mm}:${ss}`;
}

// ========== ADHAN & IQAMAH LOGIC ==========
function checkPrayerEvents() {
  if (!prayerTimes.Fajr) return;

  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const currentSec = now.getSeconds();

  if (currentSec > 3) return;

  const prayersToCheck = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  for (const key of prayersToCheck) {
    const [h, m] = prayerTimes[key].split(':').map(Number);
    const prayerMin = h * 60 + m;

    if (currentMin === prayerMin && adhanPlayedFor !== key) {
      triggerAdhan(key);
      return;
    }
  }
}

function triggerAdhan(prayerKey) {
  adhanPlayedFor = prayerKey;
  currentMode = 'adhan';

  document.getElementById('adhan-prayer-name').textContent = PRAYER_LABELS[prayerKey];
  document.getElementById('adhan-time').textContent = prayerTimes[prayerKey].substring(0, 5);
  document.getElementById('adhan-overlay').classList.add('show');

  if (config.settings?.enableAdhanSound) {
    const audio = document.getElementById('adhan-audio');
    audio.currentTime = 0;
    audio.play().catch(e => console.warn('Audio play blocked (perlu interaksi user dulu):', e));
  }

  const audio = document.getElementById('adhan-audio');
  const goToIqamah = () => {
    document.getElementById('adhan-overlay').classList.remove('show');
    if (config.settings?.enableIqamahMode) {
      startIqamah(prayerKey);
    } else {
      currentMode = 'normal';
      determineNextPrayer();
    }
  };

  audio.onended = goToIqamah;
  setTimeout(goToIqamah, 3 * 60 * 1000);
}

function startIqamah(prayerKey) {
  currentMode = 'iqamah';
  const mins = config.settings?.iqamahMinutes?.[prayerKey] || 10;
  iqamahEndTime = Date.now() + mins * 60 * 1000;

  document.getElementById('iqamah-prayer-name').textContent = PRAYER_LABELS[prayerKey];
  document.getElementById('iqamah-overlay').classList.add('show');
  updateIqamahCountdown();
}

function updateIqamahCountdown() {
  if (currentMode !== 'iqamah' || !iqamahEndTime) return;

  const remaining = Math.max(0, Math.floor((iqamahEndTime - Date.now()) / 1000));
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  document.getElementById('iqamah-countdown').textContent = `${mm}:${ss}`;

  if (remaining <= 0) {
    document.getElementById('iqamah-overlay').classList.remove('show');
    currentMode = 'normal';
    iqamahEndTime = null;
    determineNextPrayer();
  }
}

// ========== SLIDER ==========
function initSlider() {
  const track = document.getElementById('slider-track');
  const dots = document.getElementById('slider-dots');
  const slides = config.slides || [];

  if (slides.length === 0) {
    track.innerHTML = `<div class="slide active" style="background:linear-gradient(135deg,#C9A22722,#FDF8F0);display:grid;place-items:center;">
      <p style="color:#8A7B66;font-size:0.9rem;">Tambahkan gambar di data.json</p>
    </div>`;
    return;
  }

  track.innerHTML = slides.map((s, i) => `
    <div class="slide ${i === 0 ? 'active' : ''}">
      <img src="${s.image}" alt="${s.caption || ''}" loading="lazy" />
      ${s.caption ? `<div class="slide-caption">${s.caption}</div>` : ''}
    </div>
  `).join('');

  dots.innerHTML = slides.map((_, i) =>
    `<div class="dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`
  ).join('');

  dots.querySelectorAll('.dot').forEach(dot => {
    dot.addEventListener('click', () => {
      slideIndex = parseInt(dot.dataset.index);
      showSlide(slideIndex);
    });
  });
}

function showSlide(index) {
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.dot');
  slides.forEach((s, i) => s.classList.toggle('active', i === index));
  dots.forEach((d, i) => d.classList.toggle('active', i === index));
}

function startSlideRotation() {
  const interval = (config.settings?.slideIntervalSeconds || 12) * 1000;
  setInterval(() => {
    if (currentMode !== 'normal') return;
    const total = (config.slides || []).length;
    if (total === 0) return;
    slideIndex = (slideIndex + 1) % total;
    showSlide(slideIndex);
  }, interval);
}

// ========== QUOTES ==========
function startQuoteRotation() {
  showQuote();
  const interval = (config.settings?.quoteIntervalSeconds || 40) * 1000;
  setInterval(() => {
    if (currentMode !== 'normal') return;
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
  updateRunningText();
  setInterval(() => {
    runningIndex = (runningIndex + 1) % config.runningTexts.length;
    updateRunningText();
  }, 30000);
}

function updateRunningText() {
  const el = document.getElementById('running-text');
  const texts = config.runningTexts;
  el.textContent = texts[runningIndex] + '   •   ' + texts[(runningIndex + 1) % texts.length];
}

// ========== START ==========
document.addEventListener('DOMContentLoaded', init);

setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() < 3) {
    adhanPlayedFor = null;
    loadPrayerTimes();
  }
}, 60 * 1000);
