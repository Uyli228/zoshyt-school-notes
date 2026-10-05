// «Зошит» · Крок 1 з 3 — збір завдань з УСІХ курсів Google Classroom.
// Запуск: classroom.google.com (головна з курсами) → F12 → Console → встав і Enter.
// Результат: файл zoshyt_classroom.json для скрипта Gemini.
(async () => {
  const PART_SIZE = 6;                      // скільки пунктів в одному запиті до ШІ
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const junk = /^(Дата здачі|Опубліковано|Змінено|Переглянути|Більше|Матеріал|Завдання|Виконано|Призначено|Здано|Тест|Запитання|Due|Posted|Edited|View|more_vert|\d+)( |$)/i;
  const homework = /(контрольн|самостійн|лабораторн|практичн|тест|розв.?язування задач|\bк\/р\b|\bс\/р\b|вправ[аи]? ?№|задач[аі] ?№)/i;
  const theory = /(§|параграф|опрацю|вивчи|прочита|конспект|теорі)/i;

  const courses = [];
  for (const a of document.querySelectorAll('a[href*="/c/"]')) {
    const id = (a.getAttribute('href').match(/\/c\/([^/?#]+)/) || [])[1];
    const name = a.innerText.split('\n').map((s) => s.trim()).filter(Boolean)[0];
    if (id && name && !courses.some((c) => c.id === id)) courses.push({ id, name });
  }
  if (!courses.length) return console.log('❌ Курсів не знайдено. Відкрий головну сторінку classroom.google.com');
  const pick = prompt('Курси:\n' + courses.map((c, i) => `${i + 1}. ${c.name}`).join('\n') + '\n\nНомери (1,3), діапазон (1-5) або порожньо — усі:', '');
  const nums = new Set();
  (pick || '').split(/[ ,;]+/).filter(Boolean).forEach((part) => { const [a, b] = part.split('-').map(Number); for (let n = a; n <= (b || a); n++) nums.add(n); });
  const chosen = nums.size ? courses.filter((_, i) => nums.has(i + 1)) : courses;

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-5000px;top:0;width:1200px;height:900px';
  document.body.appendChild(frame);
  const prefix = location.pathname.match(/^\/u\/\d+/)?.[0] || '';
  const batch = { zoshitBatch: 1, createdAt: new Date().toISOString(), parts: [], textbooks: [] };
  let textbooks = [];
  const report = [];

  for (const [ci, course] of chosen.entries()) {
    console.log(`\n📚 (${ci + 1}/${chosen.length}) ${course.name}`);
    frame.src = `${location.origin}${prefix}/w/${course.id}/t/all`;
    await new Promise((r) => { frame.onload = r; setTimeout(r, 20000); });
    let doc;
    try { doc = frame.contentDocument; doc.body.innerText; } catch { console.log('❌ Classroom не дав відкрити курс у прихованому вікні.'); break; }
    const lines = () => doc.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    const findRows = () => [...doc.querySelectorAll('li, [role="listitem"]')].filter((el) => /Дата здачі|Опубліковано|Змінено|Без терміну|Due|Posted|Edited/i.test(el.innerText) && !el.querySelector('li, [role="listitem"]'));
    let rows = [], prev = -1;
    for (let t = 0; t < 30; t++) { await wait(1000); rows = findRows(); rows.at(-1)?.scrollIntoView({ block: 'end' }); if (rows.length && rows.length === prev) break; prev = rows.length; }

    const items = [];
    let skipped = 0;
    for (const [i, row] of rows.entries()) {
      let topic = 'Без теми', n = row;
      while (n && topic === 'Без теми') { let p = n.previousElementSibling; while (p) { const h = p.matches('h2,h3,[role="heading"]') ? p : p.querySelector?.('h2,h3,[role="heading"]'); if (h) { topic = h.innerText.trim(); break; } p = p.previousElementSibling; } n = n.parentElement; }
      const own = row.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
      const title = own.find((s) => /^\d{1,2}\.\d{1,2}\.?/.test(s)) || own.find((s) => !junk.test(s)) || own[0];
      const type = /Матеріал/i.test(row.innerText) ? 'МАТЕРІАЛ' : /Запитання/i.test(row.innerText) ? 'ЗАПИТАННЯ' : 'ЗАВДАННЯ';
      const before = new Set(lines());
      const linksBefore = new Set([...doc.querySelectorAll('a[href]')].map((a) => a.href));
      row.scrollIntoView({ block: 'center' });
      (row.querySelector('[role="button"],[aria-expanded]') || row.firstElementChild || row).click();
      let added = [];
      for (let t = 0; t < 10 && !added.length; t++) { await wait(500); added = lines().filter((s) => !before.has(s) && s !== title && !junk.test(s)); }
      const files = [...doc.querySelectorAll('a[href]')].filter((a) => !linksBefore.has(a.href) && /drive\.google|docs\.google|\.pdf|youtu|classroom\.google\.com\/.*\/m\//i.test(a.href))
        .map((a) => ({ name: (a.innerText || a.title || a.getAttribute('aria-label') || '').split('\n')[0].trim() || 'файл', url: a.href }))
        .filter((f, k, all) => all.findIndex((x) => x.url === f.url) === k);
      (row.querySelector('[aria-expanded="true"]') || row.firstElementChild || row).click();
      await wait(400);
      const text = added.join('\n');
      // пропускаємо лише чисті домашки: якщо в назві чи тексті є §/параграф/опрацювати — залишаємо
      if (homework.test(title + ' ' + text) && !theory.test(title + ' ' + text)) { skipped++; console.log(`  (${i + 1}/${rows.length}) ⏭ ${title}`); continue; }
      items.push({ topic, title, type, text: text.slice(0, 3000), files });
      files.filter((f) => /підручник|учебник|textbook|\.pdf\b|pdf$/i.test(f.name + ' ' + f.url)).forEach((f) => { if (!textbooks.some((t) => t.url === f.url)) textbooks.push({ course: course.name, subject: '', ...f }); });
      console.log(`  (${i + 1}/${rows.length}) ${type} ${title}${files.length ? ` · 📎${files.length}` : ''}`);
    }
    textbooks.forEach((t) => { t.subject ||= course.name.replace(/^\s*\d{1,2}\s*[-–—.]?\s*[А-ЯІЇЄҐA-Z]?\s*(клас)?\s*/iu, '').trim(); });
    batch.textbooks.push(...textbooks); textbooks = [];
    const subject = course.name.replace(/^\s*\d{1,2}\s*[-–—.]?\s*[А-ЯІЇЄҐA-Z]?\s*(клас)?\s*/iu, '').trim() || course.name;
    for (let start = 0; start < items.length; start += PART_SIZE) {
      batch.parts.push({ course: course.name, subject, part: start / PART_SIZE + 1, items: items.slice(start, start + PART_SIZE) });
    }
    report.push({ курс: course.name, взято: items.length, 'пропущено домашок': skipped, 'запитів до ШІ': Math.ceil(items.length / PART_SIZE) });
  }
  frame.remove();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(batch)], { type: 'application/json' }));
  a.download = 'zoshyt_classroom.json';
  a.click();
  console.table(report);
  if (batch.textbooks.length) {
    console.log('📚 Схоже на підручники — завантаж PDF і додай їх у панелі Gemini («📚 Підручники»). Назви файлів залиш з назвою предмета:');
    console.table(batch.textbooks.map((t) => ({ предмет: t.subject, файл: t.name, посилання: t.url })));
  }
  console.log(`✅ Готово! Запитів до ШІ: ${batch.parts.length}. Тепер відкрий gemini.google.com і запусти скрипт кроку 2.`);
})();
