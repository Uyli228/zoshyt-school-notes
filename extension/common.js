// Спільні помічники для всіх частин розширення «Зошит».
const Z = {
  SITE_URL: 'https://uyli228.github.io/zoshyt-school-notes/',
  PART_SIZE: 6,
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  get: (keys) => chrome.storage.local.get(keys),
  set: (values) => chrome.storage.local.set(values),
  async state() {
    const s = await chrome.storage.local.get(['seen', 'queue', 'ready', 'textbooks', 'courses', 'excluded', 'lastScan', 'baseline']);
    return { seen: s.seen || {}, queue: s.queue || [], ready: s.ready || [], textbooks: s.textbooks || [], courses: s.courses || [], excluded: s.excluded || [], lastScan: s.lastScan || 0, baseline: Boolean(s.baseline) };
  },
  // Створення елементів без innerHTML (Gemini та Classroom вимагають Trusted Types).
  h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'style') el.style.cssText = value;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else if (value !== false && value != null) el.setAttribute(key, value === true ? '' : value);
    }
    kids.flat().forEach((kid) => kid != null && el.append(kid));
    return el;
  },
  subjectOf: (courseName) => String(courseName).replace(/^\s*\d{1,2}\s*[-–—.]?\s*[А-ЯІЇЄҐA-Z]?\s*(клас)?\s*/iu, '').trim() || courseName,
  norm: (text) => String(text || '').toLowerCase().replace(/[^\p{L}\d]+/gu, ' ').trim(),
  badge(text, onClick) {
    let el = document.getElementById('zoshit-badge');
    if (!el) {
      el = Z.h('div', { id: 'zoshit-badge', style: 'position:fixed;left:16px;bottom:16px;z-index:2147483646;background:#6958d8;color:#fff;font:600 13px/1.3 system-ui,sans-serif;padding:10px 14px;border-radius:12px;box-shadow:0 8px 24px #0004;cursor:pointer;max-width:320px' });
      document.body.append(el);
    }
    el.textContent = text;
    el.onclick = onClick || null;
    el.style.display = text ? 'block' : 'none';
    return el;
  }
};
