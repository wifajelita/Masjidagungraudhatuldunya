/**
 * Masjid Agung Raudhatul Dunya - Display Masjid v3
 * Full features: Adhan multi, Iqamah, Offline, Kegiatan, Imam, Hari Besar, Dzikir, QR, Vertical scroll
 */

const PRAYER_ORDER = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];
const PRAYER_LABELS = { Fajr:'Subuh', Sunrise:'Syuruq', Dhuhr:'Dzuhur', Asr:'Ashar', Maghrib:'Maghrib', Isha:'Isya' };

let config = null;
let prayerTimes = {};
let nextPrayer = null;
let currentMode = 'normal';
let iqamahEndTime = null;
let adhanPlayedFor = null;
let panelIndex = 0;
let quoteIndex = 0;

async function init() {
  // Register Service Worker for offline
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch(e){}
  }

  try {
    const res = await fetch('data.json');
    config = await res.json();
    localStorage.setItem('masjid_config', JSON.stringify(config));
  } catch(e) {
    const cached = localStorage.getItem('masjid_config');
    config = cached ? JSON.parse(cached) : getDefaultConfig();
  }

  applyConfig();
  populateAdhanSelect();
  renderAllStatic();
  startClock();
  await loadPrayerTimes();
  startPanelRotation();
  startQuoteRotation();
  startRunningText();
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  document.getElementById('loading').classList.add('hide');
}

function getDefaultConfig() {
  return {
    mosque: { name: 'Masjid Agung Raudhatul Dunya', location: 'Bogor, Jawa Barat', fallbackLat: -6.5971, fallbackLng: 106.8060, donationText: 'Infaq & Sedekah' },
    runningTexts: ['Selamat datang'],
    quotes: [{ text: 'Dirikanlah sholat', source: 'Al-Qur\'an' }],
    kegiatanHarian: [], jadwalImam: {}, jadwalKhotib: [], hariBesar: [],
    dzikirPagi: [], dzikirPetang: [], adhanOptions: [], selectedAdhan: 'makkah',
    pengumuman: [], settings: { method:20, enableAdhanSound:true, enableIqamahMode:true, iqamahMinutes:{Fajr:15,Dhuhr:12,Asr:12,Maghrib:8,Isha:12}, sectionRotateSeconds:15 }
  };
}

function applyConfig() {
  document.getElementById('mosque-name').textContent = config.mosque.name;
  document.getElementById('mosque-location').textContent = config.mosque.location;
  document.getElementById('donation-text').textContent = config.mosque.donationText || 'Scan untuk Infaq';
}

function updateOnlineStatus() {
  const badge = document.getElementById('offline-badge');
  if (navigator.onLine) badge.classList.remove('show');
  else badge.classList.add('show');
}

// ========== RENDER STATIC CONTENT ==========
function renderAllStatic() {
  // Kegiatan
  const kList = document.getElementById('kegiatan-list');
  kList.innerHTML = (config.kegiatanHarian || []).map(k =>
    `<div class="kegiatan-item"><strong>${k.nama}</strong><br><span>${k.waktu} • ${k.pengisi}</span></div>`
  ).join('') || '<div class="kegiatan-item">Belum ada data</div>';

  // Imam
  const iList = document.getElementById('imam-list');
  const imam = config.jadwalImam || {};
  iList.innerHTML = Object.entries(imam).map(([w,n]) =>
    `<div class="imam-item"><strong>${w}</strong>: <span>${n}</span></div>`
  ).join('');

  // Khotib
  const khotib = (config.jadwalKhotib || [])[0];
  if (khotib) {
    document.getElementById('khotib-box').innerHTML =
      `<strong>Khotib ${khotib.tanggal}</strong><br>${khotib.nama}<div class="tema">"${khotib.tema}"</div>`;
  }

  // Pengumuman
  document.getElementById('pengumuman-list').innerHTML = (config.pengumuman || []).map(p =>
    `<div class="pengumuman-item"><strong>${p.ikon||'📌'} ${p.judul}</strong><br><span>${p.deskripsi}</span></div>`
  ).join('');

  // Hari Besar
  document.getElementById('haribesar-list').innerHTML = (config.hariBesar || []).map(h =>
    `<div class="haribesar-item"><strong>${h.nama}</strong><br><span>${h.tanggal} • ${h.hijri}</span></div>`
  ).join('');

  // Dzikir
  document.getElementById('dzikir-pagi').innerHTML = (config.dzikirPagi || []).map(d =>
    `<div class="dzikir-item">${d}</div>`
  ).join('');
  document.getElementById('dzikir-petang').innerHTML = (config.dzikirPetang || []).map(d =>
    `<div class="dzikir-item">${d}</div>`
  ).join('');
}

// ========== ADHAN SELECT ==========
function populateAdhanSelect() {
  const sel = document.getElementById('adhan-select');
  const opts = config.adhanOptions || [];
  sel.innerHTML = opts.map(o => `<option value="${o.id}" ${o.id===config.selectedAdhan?'selected':''}>${o.name}</option>`).join('');
  sel.addEventListener('change', () => {
    config.selectedAdhan = sel.value;
    const chosen = opts.find(o => o.id === sel.value);
    if (chosen) {
      document.getElementById('adhan-audio').src = chosen.url;
      localStorage.setItem('selected_adhan', sel.value);
    }
  });
  // Load saved
  const saved = localStorage.getItem('selected_adhan');
  if (saved) {
    sel.value = saved;
    const chosen = opts.find(o => o.id === saved);
    if (chosen) document.getElementById('adhan-audio').src = chosen.url;
  } else if (opts[0]) {
    document.getElementById('adhan-audio').src = opts[0].url;
  }
}

// ========== CLOCK ==========
function startClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    [now.getHours(), now.getMinutes(), now.getSeconds()].map(n => String(n).padStart(2,'0')).join(':');
  checkPrayerEvents();
  updateCountdown();
  updateIqamahCountdown();
}

// ========== PRAYER TIMES + OFFLINE ==========
async function loadPrayerTimes() {
  let lat = config.mosque.fallbackLat, lng = config.mosque.fallbackLng;
  try {
    const pos = await new Promise((res, rej) => {
      if (!navigator.geolocation) return rej();
      navigator.geolocation.getCurrentPosition(res, rej, { timeout:7000, maximumAge:600000 });
    });
    lat = pos.coords.latitude; lng = pos.coords.longitude;
  } catch(e) {}

  try {
    const method = config.settings?.method || 20;
    const res = await fetch(`https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lng}&method=${method}&school=0`);
    const data = await res.json();
    if (data.code === 200) {
      const t = data.data.timings;
      prayerTimes = { Fajr:t.Fajr, Sunrise:t.Sunrise, Dhuhr:t.Dhuhr, Asr:t.Asr, Maghrib:t.Maghrib, Isha:t.Isha };
      localStorage.setItem('masjid_prayer_times', JSON.stringify({ times: prayerTimes, date: new Date().toDateString(), hijri: data.data.date.hijri, greg: data.data.date.gregorian }));
      applyPrayerData(data.data.date.hijri, data.data.date.gregorian);
    } else throw new Error();
  } catch(e) {
    // Offline fallback
    const cached = localStorage.getItem('masjid_prayer_times');
    if (cached) {
      const c = JSON.parse(cached);
      prayerTimes = c.times;
      applyPrayerData(c.hijri, c.greg);
    } else {
      prayerTimes = { Fajr:'04:35', Sunrise:'05:52', Dhuhr:'12:00', Asr:'15:20', Maghrib:'18:05', Isha:'19:15' };
      document.getElementById('gregorian-date').textContent = new Date().toLocaleDateString('id-ID', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    }
  }
  renderPrayerTimes();
  determineNextPrayer();
}

function applyPrayerData(hijri, greg) {
  if (hijri) document.getElementById('hijri-date').textContent = `${hijri.day} ${hijri.month.en} ${hijri.year} H`;
  if (greg) {
    const months = {'01':'Januari','02':'Februari','03':'Maret','04':'April','05':'Mei','06':'Juni','07':'Juli','08':'Agustus','09':'September','10':'Oktober','11':'November','12':'Desember'};
    const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const d = new Date(`${greg.year}-${greg.month.number}-${greg.day}`);
    document.getElementById('gregorian-date').textContent = `${days[d.getDay()]}, ${greg.day} ${months[greg.month.number]||greg.month.en} ${greg.year}`;
  }
}

function renderPrayerTimes() {
  PRAYER_ORDER.forEach(k => {
    const el = document.getElementById(`time-${k}`);
    if (el && prayerTimes[k]) el.textContent = prayerTimes[k].substring(0,5);
  });
}

function determineNextPrayer() {
  const now = new Date();
  const cur = now.getHours()*60 + now.getMinutes();
  let found = null;
  for (const k of PRAYER_ORDER) {
    if (k === 'Sunrise') continue;
    const [h,m] = prayerTimes[k].split(':').map(Number);
    if (h*60+m > cur) { found = { key:k, time:prayerTimes[k], minutes:h*60+m }; break; }
  }
  if (!found) {
    const [h,m] = prayerTimes.Fajr.split(':').map(Number);
    found = { key:'Fajr', time:prayerTimes.Fajr, minutes:h*60+m+1440 };
  }
  nextPrayer = found;
  document.getElementById('next-prayer-name').textContent = PRAYER_LABELS[found.key];
  document.getElementById('next-prayer-time').textContent = `pukul ${found.time.substring(0,5)}`;
  document.querySelectorAll('.prayer-card').forEach(c => c.classList.toggle('active', c.dataset.prayer === found.key));
}

function updateCountdown() {
  if (!nextPrayer || currentMode !== 'normal') return;
  const now = new Date();
  const curSec = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
  let [h,m] = nextPrayer.time.split(':').map(Number);
  let target = h*3600 + m*60;
  if (nextPrayer.minutes >= 1440) target += 86400;
  let diff = target - curSec;
  if (diff < 0) { determineNextPrayer(); return; }
  document.getElementById('countdown').textContent =
    [Math.floor(diff/3600), Math.floor((diff%3600)/60), diff%60].map(n=>String(n).padStart(2,'0')).join(':');
}

// ========== ADHAN & IQAMAH ==========
function checkPrayerEvents() {
  if (!prayerTimes.Fajr || currentMode !== 'normal') return;
  const now = new Date();
  if (now.getSeconds() > 2) return;
  const cur = now.getHours()*60 + now.getMinutes();
  for (const k of ['Fajr','Dhuhr','Asr','Maghrib','Isha']) {
    const [h,m] = prayerTimes[k].split(':').map(Number);
    if (cur === h*60+m && adhanPlayedFor !== k) {
      triggerAdhan(k);
      return;
    }
  }
}

function triggerAdhan(key) {
  adhanPlayedFor = key;
  currentMode = 'adhan';
  document.getElementById('adhan-prayer-name').textContent = PRAYER_LABELS[key];
  document.getElementById('adhan-time').textContent = prayerTimes[key].substring(0,5);
  document.getElementById('adhan-overlay').classList.add('show');

  if (config.settings?.enableAdhanSound) {
    const audio = document.getElementById('adhan-audio');
    audio.currentTime = 0;
    audio.play().catch(()=>{});
  }

  const goNext = () => {
    document.getElementById('adhan-overlay').classList.remove('show');
    if (config.settings?.enableIqamahMode) startIqamah(key);
    else { currentMode = 'normal'; determineNextPrayer(); }
  };
  document.getElementById('adhan-audio').onended = goNext;
  setTimeout(goNext, 180000);
}

function startIqamah(key) {
  currentMode = 'iqamah';
  const mins = config.settings?.iqamahMinutes?.[key] || 10;
  iqamahEndTime = Date.now() + mins*60000;
  document.getElementById('iqamah-prayer-name').textContent = PRAYER_LABELS[key];
  document.getElementById('iqamah-overlay').classList.add('show');
}

function updateIqamahCountdown() {
  if (currentMode !== 'iqamah' || !iqamahEndTime) return;
  const rem = Math.max(0, Math.floor((iqamahEndTime - Date.now())/1000));
  document.getElementById('iqamah-countdown').textContent =
    [Math.floor(rem/60), rem%60].map(n=>String(n).padStart(2,'0')).join(':');
  if (rem <= 0) {
    document.getElementById('iqamah-overlay').classList.remove('show');
    currentMode = 'normal';
    iqamahEndTime = null;
    determineNextPrayer();
  }
}

// ========== PANEL ROTATION (slide content) ==========
function startPanelRotation() {
  const interval = (config.settings?.sectionRotateSeconds || 15) * 1000;
  setInterval(() => {
    if (currentMode !== 'normal') return;
    const panels = document.querySelectorAll('.rotator-panel');
    panels[panelIndex].classList.remove('active');
    panelIndex = (panelIndex + 1) % panels.length;
    panels[panelIndex].classList.add('active');
  }, interval);
}

// ========== QUOTE & RUNNING ==========
function startQuoteRotation() {
  showQuote();
  setInterval(() => {
    if (currentMode !== 'normal') return;
    quoteIndex = (quoteIndex + 1) % (config.quotes||[]).length;
    showQuote();
  }, (config.settings?.quoteIntervalSeconds || 40)*1000);
}

function showQuote() {
  const q = (config.quotes||[])[quoteIndex] || { text:'', source:'' };
  const t = document.getElementById('quote-text');
  const s = document.getElementById('quote-source');
  t.style.opacity = 0; s.style.opacity = 0;
  setTimeout(() => { t.textContent = q.text; s.textContent = q.source; t.style.opacity=1; s.style.opacity=1; }, 280);
}

function startRunningText() {
  const el = document.getElementById('running-text');
  const texts = config.runningTexts || [];
  let i = 0;
  el.textContent = texts.join('   •   ');
  setInterval(() => {
    i = (i+1) % texts.length;
    el.textContent = texts[i] + '   •   ' + texts[(i+1)%texts.length];
  }, 28000);
}

// Start
document.addEventListener('DOMContentLoaded', init);
setInterval(() => {
  const n = new Date();
  if (n.getHours()===0 && n.getMinutes()<3) { adhanPlayedFor=null; loadPrayerTimes(); }
}, 60000);
