// Classroom: тихо збирає НОВІ завдання з усіх курсів і кладе їх у чергу для Gemini.
(() => {
  const SCAN_EVERY = 6 * 3600000;               // автоматично не частіше ніж раз на 6 годин
  const junk = /^(Дата здачі|Опубліковано|Змінено|Переглянути|Більше|Матеріал|Завдання|Виконано|Призначено|Здано|Тест|Запитання|Due|Posted|Edited|View|more_vert|\d+)( |$)/i;
  const homework = /(контрольн|самостійн|лабораторн|практичн|тест|розв.?язування задач|\bк\/р\b|\bс\/р\b|вправ[аи]? ?№|задач[аі] ?№)/i;
  const theory = /(§|параграф|опрацю|вивчи|прочита|конспект|теорі)/i;
  const isHome = () => /^(\/u\/\d+)?\/?(h)?\/?$/.test(location.pathname);
  let scanning = false;

  async function scan(force) {
    if (scanning) return;
    const state = await Z.state();
    if (!force && Date.now() - state.lastScan < SCAN_EVERY) return;
    const courses = [];
    for (const a of document.querySelectorAll('a[href*="/c/"]')) {
      const id = (a.getAttribute('href').match(/\/c\/([^/?#]+)/) || [])[1];
      const name = a.innerText.split('\n').map((s) => s.trim()).filter(Boolean)[0];
      if (id && name && !courses.some((c) => c.id === id)) courses.push({ id, name });
    }
    if (!courses.length) return;
    scanning = true;
    await Z.set({ courses });
    const active = courses.filter((c) => !state.excluded.includes(c.id));
    const prefix = location.pathname.match(/^\/u\/\d+/)?.[0] || '';
    const frame = Z.h('iframe', { style: 'position:fixed;left:-5000px;top:0;width:1200px;height:900px', 'aria-hidden': 'true' });
    document.body.append(frame);
    let found = 0;
    try {
      for (const [index, course] of active.entries()) {
        Z.badge(`📒 Зошит: перевіряю «${course.name}» (${index + 1}/${active.length})…`);
        const target = `${location.origin}${prefix}/w/${course.id}/t/all`;
        frame.src = target;
        for (let t = 0; t < 40; t++) {                 // чекаємо, поки курс відкриється (до 20 с)
          await Z.wait(500);
          try { if (frame.contentWindow.location.pathname.includes(course.id) && frame.contentDocument.readyState === 'complete') break; } catch { /* ще вантажиться */ }
        }
        let doc;
        try { doc = frame.contentDocument; doc.body.innerText; } catch { Z.badge('📒 Зошит: Classroom не дав відкрити курс. Спробуй пізніше.'); break; }
        found += await scanCourse(doc, course);
      }
    } finally {
      frame.remove();
      scanning = false;
    }
    const after = await Z.state();
    await Z.set({ lastScan: Date.now(), baseline: false });
    if (state.baseline) Z.badge('📒 Зошит: усе наявне позначено як оброблене. Далі збиратиму лише нове.', () => Z.badge(''));
    else if (after.queue.length) Z.badge(`📒 Зошит: нових пунктів ${found}, у черзі ${after.queue.length}. Натисни, щоб обробити в Gemini →`, () => window.open('https://gemini.google.com/app#zoshit-run', '_blank'));
    else Z.badge('📒 Зошит: нових завдань немає ✓', () => Z.badge(''));
    setTimeout(() => { if (!after.queue.length) Z.badge(''); }, 8000);
  }

  async function scanCourse(doc, course) {
    const lines = () => doc.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    const findRows = () => [...doc.querySelectorAll('li, [role="listitem"]')].filter((el) => /Дата здачі|Опубліковано|Змінено|Без терміну|Due|Posted|Edited/i.test(el.innerText) && !el.querySelector('li, [role="listitem"]'));
    let rows = [], prev = -1;
    for (let t = 0; t < 30; t++) { await Z.wait(1000); rows = findRows(); rows.at(-1)?.scrollIntoView({ block: 'end' }); if (rows.length && rows.length === prev) break; prev = rows.length; }
    const state = await Z.state();
    const seen = { ...state.seen }, queue = [...state.queue], textbooks = [...state.textbooks];
    const subject = Z.subjectOf(course.name);
    let added = 0;
    for (const row of rows) {
      let topic = 'Без теми', n = row;
      while (n && topic === 'Без теми') { let p = n.previousElementSibling; while (p) { const h = p.matches('h2,h3,[role="heading"]') ? p : p.querySelector?.('h2,h3,[role="heading"]'); if (h) { topic = h.innerText.trim(); break; } p = p.previousElementSibling; } n = n.parentElement; }
      const own = row.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
      const title = own.find((s) => /^\d{1,2}\.\d{1,2}\.?/.test(s)) || own.find((s) => !junk.test(s)) || own[0];
      const key = `${course.id}|${title}`;
      if (seen[key]) continue;                      // уже бачили — навіть не розгортаємо
      seen[key] = Date.now();
      if (state.baseline) continue;                 // режим «позначити все наявне як оброблене»
      const type = /Матеріал/i.test(row.innerText) ? 'МАТЕРІАЛ' : /Запитання/i.test(row.innerText) ? 'ЗАПИТАННЯ' : 'ЗАВДАННЯ';
      const before = new Set(lines());
      const linksBefore = new Set([...doc.querySelectorAll('a[href]')].map((a) => a.href));
      row.scrollIntoView({ block: 'center' });
      (row.querySelector('[role="button"],[aria-expanded]') || row.firstElementChild || row).click();
      let extra = [];
      for (let t = 0; t < 10 && !extra.length; t++) { await Z.wait(500); extra = lines().filter((s) => !before.has(s) && s !== title && !junk.test(s)); }
      const files = [...doc.querySelectorAll('a[href]')].filter((a) => !linksBefore.has(a.href) && /drive\.google|docs\.google|\.pdf|youtu/i.test(a.href))
        .map((a) => ({ name: (a.innerText || a.title || a.getAttribute('aria-label') || '').split('\n')[0].trim() || 'файл', url: a.href }))
        .filter((f, k, all) => all.findIndex((x) => x.url === f.url) === k);
      (row.querySelector('[aria-expanded="true"]') || row.firstElementChild || row).click();
      await Z.wait(400);
      const text = extra.join('\n');
      files.filter((f) => /підручник|учебник|textbook|\.pdf\b|pdf$/i.test(f.name + ' ' + f.url)).forEach((f) => { if (!textbooks.some((t) => t.url === f.url)) textbooks.push({ subject, ...f }); });
      if (homework.test(`${title} ${text}`) && !theory.test(`${title} ${text}`)) continue;
      queue.push({ id: key, course: course.name, subject, topic, title, type, text: text.slice(0, 3000), files });
      added++;
    }
    await Z.set({ seen, queue, textbooks });
    return added;
  }

  const forced = location.hash.includes('zoshit-scan');
  let lastPath = '';
  setInterval(() => {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    if (isHome()) setTimeout(() => scan(forced && !scan.done).then(() => { scan.done = true; }), 2500);
  }, 1500);
  chrome.runtime.onMessage?.addListener((message) => { if (message === 'zoshit-scan' && isHome()) scan(true); });
})();
