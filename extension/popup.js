const SITE_URL = 'https://uyli228.github.io/zoshyt-school-notes/';
const $ = (id) => document.getElementById(id);
const open = (url) => chrome.tabs.create({ url });

async function render() {
  const s = await chrome.storage.local.get(['queue', 'ready', 'imported', 'lastScan', 'courses', 'excluded', 'baseline']);
  const queue = s.queue || [], ready = s.ready || [], excluded = s.excluded || [];
  $('queue').textContent = queue.length;
  $('ready').textContent = ready.length;
  $('imported').textContent = s.imported || 0;
  $('lastScan').textContent = s.baseline ? 'Наступна перевірка лише запам’ятає наявні завдання.' : s.lastScan ? `Остання перевірка Classroom: ${new Date(s.lastScan).toLocaleString('uk-UA')}` : 'Classroom ще не перевірявся.';
  const next = $('next');
  if (ready.length) { next.textContent = `📥 Імпортувати ${ready.length} на «Зошит»`; next.onclick = () => open(SITE_URL + '#zoshit-import'); }
  else if (queue.length) { next.textContent = `🤖 Обробити ${queue.length} пункт(ів) у Gemini`; next.onclick = () => open('https://gemini.google.com/app#zoshit-run'); }
  else { next.textContent = '🔄 Перевірити нові завдання'; next.onclick = () => open('https://classroom.google.com/#zoshit-scan'); }
  const courses = s.courses || [];
  if (courses.length) {
    $('courses').replaceChildren(...courses.map((c) => {
      const box = Object.assign(document.createElement('input'), { type: 'checkbox', checked: !excluded.includes(c.id) });
      box.onchange = async () => { const cur = (await chrome.storage.local.get('excluded')).excluded || []; await chrome.storage.local.set({ excluded: box.checked ? cur.filter((id) => id !== c.id) : [...cur, c.id] }); };
      const label = document.createElement('label'); label.append(box, c.name); return label;
    }));
  }
}
$('scan').onclick = () => open('https://classroom.google.com/#zoshit-scan');
$('gemini').onclick = () => open('https://gemini.google.com/app#zoshit-run');
$('site').onclick = () => open(SITE_URL + '#zoshit-import');
$('baseline').onclick = async () => {
  if (!confirm('Позначити всі наявні завдання в Classroom як уже оброблені? Далі збиратимуться лише нові.')) return;
  await chrome.storage.local.set({ baseline: true, queue: [] });
  open('https://classroom.google.com/#zoshit-scan');
};
$('clearQueue').onclick = async () => { if (confirm('Очистити чергу й готові матеріали?')) { await chrome.storage.local.set({ queue: [], ready: [] }); render(); } };
$('reset').onclick = async () => { if (confirm('Скинути все? Наступна перевірка збере всі завдання заново.')) { await chrome.storage.local.set({ seen: {}, queue: [], ready: [], lastScan: 0, baseline: false }); render(); } };
chrome.storage.onChanged.addListener(render);
render();
