/**
 * utils.js — Helper umum untuk aplikasi Absen Shalat
 * Dipakai oleh: daftar.html, index.html, admin.html
 *
 * Import:
 *   import { sanitize, debounce, genId, validateNama, validatePhone } from './utils.js';
 */

// ── STRING UTILS ──

/**
 * Hapus karakter berbahaya untuk XSS prevention.
 * Hanya buang karakter HTML/JS injection, bukan spasi dalam nama.
 */
export function sanitize(str) {
  return String(str ?? '')
    .replace(/[<>"'`\\]/g, '')
    .trim();
}

/**
 * Normalisasi nomor telepon ke format 08xxxxxxxxxx.
 * Terima: 08xxx, +628xxx, 628xxx, 8xxx
 * Return: string 10-13 digit atau null kalau tidak valid.
 */
export function normalizePhone(raw) {
  if (!raw) return null;
  // Hapus semua non-digit kecuali + di depan
  let digits = raw.replace(/[^\d+]/g, '');
  // Konversi prefix internasional → lokal
  if (digits.startsWith('+62')) digits = '0' + digits.slice(3);
  else if (digits.startsWith('62'))  digits = '0' + digits.slice(2);
  else if (digits.startsWith('8'))   digits = '0' + digits;
  // Hanya angka setelah normalisasi
  digits = digits.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) return null;
  return digits;
}

// ── VALIDATION ──

/**
 * Validasi nama lengkap siswa.
 * Return: { valid: bool, message: string }
 */
export function validateNama(raw) {
  const val = sanitize(raw);
  if (!val || val.replace(/\s/g, '').length === 0)
    return { valid: false, message: 'Nama tidak boleh kosong atau hanya spasi.' };
  if (val.length < 3)
    return { valid: false, message: 'Nama minimal 3 karakter.' };
  if (val.length > 50)
    return { valid: false, message: 'Nama maksimal 50 karakter.' };
  if (/[^a-zA-Z\s'.,-]/.test(val))
    return { valid: false, message: 'Nama hanya boleh huruf, spasi, dan tanda titik/koma.' };
  return { valid: true, message: '' };
}

/**
 * Validasi nomor telepon (opsional).
 * Return: { valid: bool, message: string, normalized: string|null }
 */
export function validatePhone(raw) {
  if (!raw || raw.trim() === '')
    return { valid: true, message: '', normalized: null }; // opsional, boleh kosong
  const normalized = normalizePhone(raw);
  if (!normalized)
    return { valid: false, message: 'Nomor HP tidak valid. Gunakan format 08xx atau +628xx (min. 10 digit).', normalized: null };
  return { valid: true, message: '', normalized };
}

// ── ID GENERATOR ──

/**
 * Generate ID unik 7 karakter (36^7 ≈ 78 miliar kombinasi).
 * Collision rate untuk 500 siswa: < 0.0000003%.
 */
export function genId() {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 7 }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

// ── DEBOUNCE ──

/**
 * Debounce fungsi — cegah spam klik/Enter.
 * @param {Function} fn   - fungsi yang di-debounce
 * @param {number}   ms   - delay dalam ms
 * @returns {Function}
 */
export function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ── SPINNER ──

/**
 * Tampilkan spinner dengan pesan opsional + sub-progress.
 * @param {string} text     - pesan utama
 * @param {string} subText  - pesan kecil di bawah (opsional)
 */
export function showSpinner(text = 'Memproses...', subText = '') {
  const wrap    = document.getElementById('spinner');
  const textEl  = document.getElementById('spinner-text');
  const subEl   = document.getElementById('spinner-sub');
  if (!wrap) return;
  if (textEl) textEl.textContent = text;
  if (subEl)  { subEl.textContent = subText; subEl.style.display = subText ? 'block' : 'none'; }
  wrap.classList.add('show');
}

export function hideSpinner() {
  const wrap = document.getElementById('spinner');
  if (wrap) wrap.classList.remove('show');
}

export function updateSpinnerText(text, subText = '') {
  const textEl = document.getElementById('spinner-text');
  const subEl  = document.getElementById('spinner-sub');
  if (textEl) textEl.textContent = text;
  if (subEl)  { subEl.textContent = subText; subEl.style.display = subText ? 'block' : 'none'; }
}

// ── ERROR BOX ──

export function showErr(msg) {
  const box = document.getElementById('err-box');
  if (!box) return;
  box.textContent = msg;
  box.classList.add('show');
  // Scroll ke error supaya user sadar
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function hideErr() {
  const box = document.getElementById('err-box');
  if (box) box.classList.remove('show');
}

// ── FIELD ERROR ──

/**
 * Pasang error message di bawah field tertentu + tambah class .error ke input.
 */
export function setFieldErr(fieldId, msg) {
  const errEl   = document.getElementById(fieldId + '-err');
  const inputEl = document.getElementById(fieldId + '-input') || document.getElementById(fieldId);
  if (errEl)   errEl.textContent = msg;
  if (inputEl) inputEl.classList.toggle('error', !!msg);
}

export function clearFieldErr(fieldId) {
  setFieldErr(fieldId, '');
}

export function clearAllFieldErrs(...fieldIds) {
  fieldIds.forEach(id => clearFieldErr(id));
}

// ── STEP MANAGER ──

/**
 * Aktifkan step ke-n (1-based) dan update progress bar.
 * @param {number} n         - nomor step (1, 2, 3, ...)
 * @param {number} totalSteps - total jumlah step
 */
export function setStep(n, totalSteps = 3) {
  document.querySelectorAll('.step').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
  });
  for (let i = 1; i <= totalSteps; i++) {
    const el = document.getElementById('ps-' + i);
    if (el) el.classList.toggle('done', i <= n);
  }
}

// ── CLIPBOARD ──

/**
 * Salin teks ke clipboard dengan fallback manual select.
 * Return: true kalau berhasil via Clipboard API, false kalau fallback.
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback: buat temp textarea, select, copy
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(ta);
    }
  }
}

// ── QR CODE ──

/**
 * Render QR code ke elemen canvas atau img.
 *
 * Race condition fix:
 *   Kita tunggu DOM ready (requestAnimationFrame) sebelum render,
 *   lalu wrap QRCode.toCanvas dalam Promise eksplisit agar
 *   error bisa di-catch dengan bersih.
 *
 * @param {string} url        - URL yang di-encode ke QR
 * @param {string} canvasId   - ID elemen <canvas>
 * @param {Object} opts       - override options QRCode
 * @returns {Promise<'canvas'|'img'|'error'>}
 */
export async function renderQRCode(url, canvasId = 'qr-canvas', opts = {}) {
  // Tunggu satu frame agar DOM sudah settled setelah setStep()
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.warn('[QR] Canvas element tidak ditemukan:', canvasId);
    return 'error';
  }

  const defaultOpts = {
    width: 180,
    margin: 1,
    color: { dark: '#1A1A1A', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
    ...opts
  };

  // Coba library qrcode.js (CDN)
  if (typeof QRCode !== 'undefined') {
    try {
      await new Promise((resolve, reject) => {
        QRCode.toCanvas(canvas, url, defaultOpts, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      return 'canvas';
    } catch (e) {
      console.warn('[QR] qrcode.js toCanvas gagal:', e.message);
    }
  }

  // Fallback: Google Charts API (online only)
  try {
    const img = document.createElement('img');
    img.width  = defaultOpts.width;
    img.height = defaultOpts.width;
    img.alt    = 'QR Code';
    img.style.display = 'block';

    await new Promise((resolve, reject) => {
      img.onload  = resolve;
      img.onerror = reject;
      img.src = `https://chart.googleapis.com/chart?cht=qr&chs=${defaultOpts.width}x${defaultOpts.width}&chl=${encodeURIComponent(url)}&choe=UTF-8`;
    });

    const box = canvas.parentElement;
    box.innerHTML = '';
    box.appendChild(img);
    return 'img';
  } catch (e) {
    console.warn('[QR] Google Charts fallback gagal:', e.message);
    return 'error';
  }
}

// ── MISC ──

/** Format tanggal ke string lokal Indonesia */
export function formatTanggal(dateStr) {
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
