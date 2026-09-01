/**
 * Masjid Agung Raudhatul Dunya - Display v4 (Full Scroll Layout)
 */
const PRAYER_ORDER = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];
const PRAYER_LABELS = { Fajr:'Subuh', Sunrise:'Syuruq', Dhuhr:'Dzuhur', Asr:'Ashar', Maghrib:'Maghrib', Isha:'Isya' };

let config = null, prayerTimes = {}, nextPrayer = null;
let currentMode = 'normal', iqamahEndTime = null, adhanPlayedFor = null;

async function init() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch(e){}
  }
  try {
    const res = await fetch('data.json');
    config = await res.json();
    localStorage.setItem('masjid_config', JSON.stringify(config));
  } catch(e) {
    const c = localStorage.getItem('masjid_config');
    config = c ? JSON.parse(c) : getDefault();
  }

  renderStatic();
  populateAdhan();
  startClock();
  await loadPrayerTimes();
  startRunning();
  updateOnline();
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  document.getElementById('loading').classList.add('hide');
}

function getDefault() {
  return {
    mosque: { name:'Masjid Agung Raudhatul Dunya', location:'Bogor, Jawa Barat', fallbackLat:-6.5971, fallbackLng:106.8060, donationText:'Infaq & Sedekah' },
    runningTexts: ['Selamat datang di Masjid Agung Raudhatul Dunya'],
    quotes: [], kegiatanHarian: [], jadwalImam: {}, jadwalKhotib: [], hariBesar: [],
    dzikirPagi: [], dzikirPetang: [], adhanOptions: [], selectedAdhan: 'makkah', pengumuman: [],
    settings: { method:20, enableAdhanSound:true, enableIqamahMode:true, iqamahMinutes:{Fajr:15,Dhuhr:12,Asr:12,Maghrib:8,Isha:12} }
  };
}

function updateOnline() {
  document.getElementById('offline-badge').classList.toggle('show', !navigator.onLine);
}

function renderStatic() {
  // Kegiatan
  document.getElementById('kegiatan-list').innerHTML = (config.kegiatanHarian||[]).map(k =>
    `<div class="kajian-item"><strong>${k.nama}</strong><span>${k.waktu} • ${k.pengisi}</span></div>`
  ).join('') || '<div class="kajian-item">Belum ada data</div>';

  // Imam
  const imam = config.jadwalImam || {};
  document.getElementById('imam-list').innerHTML = Object.entries(imam).map(([w,n]) =>
    `<div class="imam-row"><strong>${w}</strong><span>${n}</span></div>`
  ).join('');

  // Khotib
  const kh = (config.jadwalKhotib||[])[0];
  if (kh) {
    document.getElementById('khotib-box').innerHTML =
      `<div class="khotib-item"><strong>${kh.tanggal}</strong><br>${kh.nama}<div class="tema">"${kh.tema}"</div></div>`;
  }

  // Hari Besar
  document.getElementById('haribesar-list').innerHTML = (config.hariBesar||[]).map(h =>
    `<div class="hari-item"><strong>${h.nama}</strong><span>${h.tanggal}<br>${h.hijri}</span></div>`
  ).join('');

  // Dzikir
  document.getElementById('dzikir-pagi').innerHTML = (config.dzikirPagi||[]).map(d =>
    `<div class="dzikir-item">${d}</div>`
  ).join('');
  document.getElementById('dzikir-petang').innerHTML = (config.dzikirPetang||[]).map(d =>
    `<div class="dzikir-item">${d}</div>`
  ).join('');

  // Pengumuman
  document.getElementById('pengumuman-list').innerHTML = (config.pengumuman||[]).map(p =>
    `<div class="peng-item"><div class="peng-ikon">${p.ikon||'📌'}</div><div><strong>${p.judul}</strong><span>${p.deskripsi}</span></div></div>`
  ).join('');
}

function populateAdhan() {
  const sel = document.getElementById('adhan-select');
  const opts = config.adhanOptions || [];
  sel.innerHTML = opts.map(o => `<option value="${o.id}" ${o.id===config.selectedAdhan?'selected':''}>${o.name}</option>`).join('');
  const apply = (id) => {
    const c = opts.find(o => o.id === id);
    if (c) document.getElementById('adhan-audio').src = c.url;
  };
  sel.addEventListener('change', () => { localStorage.setItem('selected_adhan', sel.value); apply(sel.value); });
  const saved = localStorage.getItem('selected_adhan') || config.selectedAdhan;
  if (saved) { sel.value = saved; apply(saved); }
  else if (opts[0]) apply(opts[0].id);
}

function startClock() {
  tick();
  setInterval(tick, 1000);
}

function tick() {
  const n = new Date();
  document.getElementById('clock').textContent =
    [n.getHours(),n.getMinutes(),n.getSeconds()].map(x=>String(x).padStart(2,'0')).join(':');
  // Calendar
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  document.getElementById('cal-day').textContent = days[n.getDay()];
  document.getElementById('cal-date').textContent = n.getDate() + ' ' + n.toLocaleDateString('id-ID',{month:'long'}) + ' ' + n.getFullYear();

  checkPrayerEvents();
  updateCountdown();
  updateIqamah();
}

async function loadPrayerTimes() {
  let lat = config.mosque.fallbackLat, lng = config.mosque.fallbackLng;
  try {
    const pos = await new Promise((res,rej)=>{
      if(!navigator.geolocation) return rej();
      navigator.geolocation.getCurrentPosition(res,rej,{timeout:7000,maximumAge:600000});
    });
    lat = pos.coords.latitude; lng = pos.coords.longitude;
  } catch(e){}

  try {
    const method = config.settings?.method || 20;
    const res = await fetch(`https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lng}&method=${method}&school=0`);
    const data = await res.json();
    if (data.code === 200) {
      const t = data.data.timings;
      prayerTimes = { Fajr:t.Fajr, Sunrise:t.Sunrise, Dhuhr:t.Dhuhr, Asr:t.Asr, Maghrib:t.Maghrib, Isha:t.Isha };
      localStorage.setItem('masjid_prayer_times', JSON.stringify({
        times: prayerTimes, hijri: data.data.date.hijri, greg: data.data.date.gregorian
      }));
      applyDate(data.data.date.hijri, data.data.date.gregorian);
    } else throw 0;
  } catch(e) {
    const c = localStorage.getItem('masjid_prayer_times');
    if (c) {
      const p = JSON.parse(c);
      prayerTimes = p.times;
      applyDate(p.hijri, p.greg);
    } else {
      prayerTimes = { Fajr:'04:35', Sunrise:'05:52', Dhuhr:'12:00', Asr:'15:20', Maghrib:'18:05', Isha:'19:15' };
    }
  }
  renderTimes();
  determineNext();
}

function applyDate(hijri, greg) {
  if (hijri) {
    const htxt = `${hijri.day} ${hijri.month.en} ${hijri.year} H`;
    document.getElementById('hero-hijri').textContent = htxt;
    document.getElementById('cal-hijri').textContent = htxt;
  }
  if (greg) {
    const months = {'01':'Januari','02':'Februari','03':'Maret','04':'April','05':'Mei','06':'Juni','07':'Juli','08':'Agustus','09':'September','10':'Oktober','11':'November','12':'Desember'};
    const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const d = new Date(`${greg.year}-${greg.month.number}-${greg.day}`);
    const gtxt = `${days[d.getDay()]}, ${greg.day} ${months[greg.month.number]||greg.month.en} ${greg.year}`;
    document.getElementById('hero-date').textContent = gtxt;
  }
}

function renderTimes() {
  PRAYER_ORDER.forEach(k => {
    const el = document.getElementById('time-'+k);
    if (el && prayerTimes[k]) el.textContent = prayerTimes[k].substring(0,5);
  });
}

function determineNext() {
  const now = new Date();
  const cur = now.getHours()*60 + now.getMinutes();
  let found = null;
  for (const k of PRAYER_ORDER) {
    if (k==='Sunrise') continue;
    const [h,m] = prayerTimes[k].split(':').map(Number);
    if (h*60+m > cur) { found={key:k,time:prayerTimes[k],minutes:h*60+m}; break; }
  }
  if (!found) {
    const [h,m] = prayerTimes.Fajr.split(':').map(Number);
    found={key:'Fajr',time:prayerTimes.Fajr,minutes:h*60+m+1440};
  }
  nextPrayer = found;
  document.getElementById('next-prayer-name').textContent = PRAYER_LABELS[found.key];
  document.getElementById('next-prayer-time').textContent = 'pukul '+found.time.substring(0,5);
  document.querySelectorAll('.p-card').forEach(c => c.classList.toggle('active', c.dataset.prayer===found.key));
}

function updateCountdown() {
  if (!nextPrayer || currentMode!=='normal') return;
  const now = new Date();
  const cur = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
  let [h,m] = nextPrayer.time.split(':').map(Number);
  let target = h*3600+m*60;
  if (nextPrayer.minutes>=1440) target += 86400;
  let diff = target - cur;
  if (diff<0) { determineNext(); return; }
  document.getElementById('countdown').textContent =
    [Math.floor(diff/3600), Math.floor((diff%3600)/60), diff%60].map(x=>String(x).padStart(2,'0')).join(':');
}

function checkPrayerEvents() {
  if (!prayerTimes.Fajr || currentMode!=='normal') return;
  const now = new Date();
  if (now.getSeconds()>2) return;
  const cur = now.getHours()*60 + now.getMinutes();
  for (const k of ['Fajr','Dhuhr','Asr','Maghrib','Isha']) {
    const [h,m] = prayerTimes[k].split(':').map(Number);
    if (cur===h*60+m && adhanPlayedFor!==k) { triggerAdhan(k); return; }
  }
}

function triggerAdhan(key) {
  adhanPlayedFor = key;
  currentMode = 'adhan';
  document.getElementById('adhan-prayer-name').textContent = PRAYER_LABELS[key];
  document.getElementById('adhan-time').textContent = prayerTimes[key].substring(0,5);
  document.getElementById('adhan-overlay').classList.add('show');
  if (config.settings?.enableAdhanSound) {
    const a = document.getElementById('adhan-audio');
    a.currentTime=0; a.play().catch(()=>{});
  }
  const next = () => {
    document.getElementById('adhan-overlay').classList.remove('show');
    if (config.settings?.enableIqamahMode) startIqamah(key);
    else { currentMode='normal'; determineNext(); }
  };
  document.getElementById('adhan-audio').onended = next;
  setTimeout(next, 180000);
}

function startIqamah(key) {
  currentMode = 'iqamah';
  const mins = config.settings?.iqamahMinutes?.[key] || 10;
  iqamahEndTime = Date.now() + mins*60000;
  document.getElementById('iqamah-prayer-name').textContent = PRAYER_LABELS[key];
  document.getElementById('iqamah-overlay').classList.add('show');
}

function updateIqamah() {
  if (currentMode!=='iqamah' || !iqamahEndTime) return;
  const rem = Math.max(0, Math.floor((iqamahEndTime-Date.now())/1000));
  document.getElementById('iqamah-countdown').textContent =
    [Math.floor(rem/60), rem%60].map(x=>String(x).padStart(2,'0')).join(':');
  if (rem<=0) {
    document.getElementById('iqamah-overlay').classList.remove('show');
    currentMode='normal'; iqamahEndTime=null; determineNext();
  }
}

function startRunning() {
  const el = document.getElementById('running-text');
  const texts = config.runningTexts || [];
  el.textContent = texts.join('   •   ');
}

document.addEventListener('DOMContentLoaded', init);
setInterval(() => {
  const n = new Date();
  if (n.getHours()===0 && n.getMinutes()<3) { adhanPlayedFor=null; loadPrayerTimes(); }
}, 60000);
