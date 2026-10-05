// «Зошит» · Крок 2 з 3 — Gemini сам робить конспекти з файлу zoshyt_classroom.json.
// Запуск: gemini.google.com → F12 → Console → встав і Enter → у панелі справа вибери файл.
// Результат: файл zoshyt_import.json для «Імпорт матеріалів» на сайті «Зошит».
(() => {
  if (window.__zoshitGemini) return window.__zoshitGemini.show();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const STORE = 'zoshit-gemini-run-v1';
  const $q = (list) => { for (const s of list) { const el = document.querySelector(s); if (el) return el; } return null; };
  const sel = {
    input: ['rich-textarea .ql-editor', 'div.ql-editor[contenteditable="true"]', '[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]'],
    send: ['button.send-button', 'button[aria-label*="Send" i]', 'button[aria-label*="Надіслати" i]', 'button[aria-label*="Отправить" i]', 'button[data-test-id="send-button"]'],
    stop: ['button[aria-label*="Stop" i]', 'button[aria-label*="Зупин" i]', 'button[aria-label*="Остановить" i]', 'button.stop'],
    newChat: ['[data-test-id="new-chat-button"] a', '[data-test-id="new-chat-button"] button', '[data-test-id="new-chat-button"]', 'a[href="/app"]', 'button[aria-label*="New chat" i]', '[aria-label*="Новий чат" i]', '[aria-label*="Новый чат" i]']
  };
  const responses = () => [...document.querySelectorAll('model-response')];

  // ---------- панель ----------
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;width:340px;max-height:70vh;overflow:auto;background:#fff;color:#20243a;border:2px solid #6958d8;border-radius:14px;box-shadow:0 12px 40px #0004;font:13px/1.45 system-ui,sans-serif;padding:14px';
  const h = (tag, attrs = {}, ...kids) => { const el = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') el.style.cssText = v; else el.setAttribute(k, v); } kids.forEach((kid) => el.append(kid)); return el; };
  const btn = 'padding:8px;border:1px solid #ccc;border-radius:9px;background:#fff;cursor:pointer;font:inherit';
  panel.append(
    h('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px' }, h('b', { style: 'font-size:15px' }, '📒 Зошит × Gemini'), h('button', { 'data-x': '', style: 'border:0;background:none;font-size:18px;cursor:pointer' }, '×')),
    h('button', { 'data-file': '', style: 'width:100%;padding:10px;border:0;border-radius:9px;background:#6958d8;color:#fff;font-weight:700;cursor:pointer;font:inherit' }, '📂 Вибрати zoshyt_classroom.json і почати'),
    h('button', { 'data-harvest': '', style: 'width:100%;margin-top:6px;background:#f6f7fb;' + btn }, 'Або: зібрати JSON з уже наявних чатів'),
    h('div', { style: 'display:flex;gap:6px;margin-top:6px' }, h('button', { 'data-stop': '', disabled: '', style: 'flex:1;' + btn }, '⏸ Пауза'), h('button', { 'data-save': '', style: 'flex:1;' + btn }, '💾 Скачати що є')),
    h('div', { 'data-bar': '', style: 'height:8px;background:#eee;border-radius:9px;margin:10px 0 6px;overflow:hidden' }, h('i', { style: 'display:block;height:100%;width:0;background:#42a997' })),
    h('div', { 'data-status': '', style: 'font-weight:600' }, 'Готовий до роботи.'),
    h('div', { 'data-log': '', style: 'margin-top:6px;font-size:12px;color:#555;white-space:pre-wrap' }),
    h('input', { type: 'file', accept: '.json,application/json', hidden: '' })
  );
  document.body.appendChild(panel);
  const ui = (k) => panel.querySelector(`[data-${k}]`);
  const status = (t) => { ui('status').textContent = t; };
  const log = (t) => { ui('log').textContent = (t + '\n' + ui('log').textContent).slice(0, 4000); console.log('[Зошит]', t); };
  const bar = (done, total) => { ui('bar').firstElementChild.style.width = `${total ? done / total * 100 : 0}%`; };
  let stopped = false, running = false;
  window.__zoshitGemini = { show: () => { panel.style.display = 'block'; } };
  ui('x').onclick = () => { panel.style.display = 'none'; };
  ui('stop').onclick = () => { stopped = true; status('⏸ Зупиняюсь після поточного запиту…'); };

  const loadRun = () => { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; } };
  const saveRun = (run) => { try { localStorage.setItem(STORE, JSON.stringify(run)); } catch { /* великий обсяг — не страшно */ } };
  const download = (materials) => {
    const seen = new Set();
    const unique = materials.filter((m) => { const k = `${m.subject}|${m.title}`.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ materials: unique }, null, 1)], { type: 'application/json' }));
    a.download = 'zoshyt_import.json'; a.click();
    log(`💾 Збережено zoshyt_import.json — матеріалів: ${unique.length}`);
  };
  ui('save').onclick = () => download(loadRun()?.materials || []);

  const buildPrompt = (part) => `Ти готуєш конспекти для шкільної бібліотеки «Зошит». Нижче — пункти з Google Classroom (курс «${part.course}»).

1. ВІДБІР. Залиш тільки теорію: опрацювання / вивчення параграфа чи теми, теоретичні матеріали уроку. ВИКИНЬ: розв'язування задач, вправи, номери з підручника, тести, самостійні, контрольні, лабораторні, практичні, оголошення, порожні пункти.
2. КОНСПЕКТ. Для кожного залишеного пункту — шкільний конспект українською, 200–600 слів. Оформлення Markdown: підзаголовки "### ", списки "- ", **жирним** ключові терміни. Формули — LaTeX між знаками долара: $F = ma$, окремим рядком $$E_k = \\frac{mv^2}{2}$$ (у JSON подвоюй зворотні слеші). Не вигадуй фактів; якщо тема незрозуміла — пропусти пункт.
3. КВІЗ І КАРТКИ. До кожного конспекту: квіз на 5 запитань (3–4 варіанти, answer — номер правильного варіанта від 0) і 6 флеш-карток (front — термін або запитання, мінімум 2 символи; back — відповідь).
4. РЕЗУЛЬТАТ. Поверни ЛИШЕ один блок коду json:
{"materials":[{"subject":"${part.subject}","topic":"розділ з Classroom","title":"§N. Назва теми без дати","summary":"одне речення","content":"конспект у Markdown","tags":["слово","слово"],"quiz":{"title":"Перевір себе","questions":[{"question":"…","options":["…","…","…"],"answer":0,"explanation":"…"}]},"flashcards":{"title":"Картки","cards":[{"front":"…","back":"…"}]}}]}
Якщо нічого не підходить — поверни {"materials":[]}. JSON має бути валідним.

ПУНКТИ:
${part.items.map((it, i) => `\n===== ${i + 1}. [${it.type}] ${it.title}\nРозділ: ${it.topic}\n${it.text || '(тексту немає — орієнтуйся на назву)'}`).join('\n')}`;

  const extractMaterials = (root) => {
    if (!root) return null;
    const blocks = [...root.querySelectorAll('pre, code-block, code')].map((el) => el.innerText).filter((t) => /"materials"/.test(t));
    if (!blocks.length) { const text = root.innerText; const start = text.indexOf('{'); if (start >= 0 && /"materials"/.test(text)) blocks.push(text.slice(start, text.lastIndexOf('}') + 1)); }
    for (const block of blocks.reverse()) { try { const parsed = JSON.parse(block.trim()); if (Array.isArray(parsed.materials)) return parsed.materials; } catch { /* наступний блок */ } }
    return null;
  };

  async function newChat() {
    const before = location.pathname;
    const button = $q(sel.newChat);
    if (!button) { log('⚠ Не знайшов кнопку «Новий чат» — продовжую в цьому ж чаті.'); return; }
    button.click();
    for (let t = 0; t < 20; t++) { await wait(500); if (!responses().length && location.pathname !== before || location.pathname === '/app') break; }
    await wait(800);
  }
  async function ask(text) {
    const input = $q(sel.input);
    if (!input) throw new Error('Не знайшов поле вводу Gemini');
    const count = responses().length;
    input.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
    await wait(600);
    let send;
    for (let t = 0; t < 20; t++) { send = $q(sel.send); if (send && !send.disabled && send.getAttribute('aria-disabled') !== 'true') break; await wait(300); }
    if (!send) throw new Error('Не знайшов кнопку надсилання');
    send.click();
    for (let t = 0; t < 120 && responses().length <= count; t++) await wait(500);
    let last = '', same = 0;
    for (let t = 0; t < 360; t++) {                 // до ~9 хв на відповідь
      await wait(1500);
      const now = responses().at(-1)?.innerText || '';
      same = now && now === last && !$q(sel.stop) ? same + 1 : 0;
      last = now;
      if (same >= 3) break;
    }
    return responses().at(-1);
  }

  async function runBatch(batch) {
    const id = `${batch.createdAt}|${batch.parts.length}`;
    let run = loadRun();
    if (!run || run.id !== id) run = { id, done: [], failed: [], materials: [] };
    else log(`↻ Продовжую: вже готово ${run.done.length} з ${batch.parts.length}`);
    running = true; stopped = false; ui('stop').disabled = false;
    for (const [index, part] of batch.parts.entries()) {
      if (stopped) break;
      if (run.done.includes(index)) continue;
      bar(run.done.length, batch.parts.length);
      status(`⏳ ${run.done.length + 1}/${batch.parts.length}: ${part.course}, частина ${part.part}`);
      let materials = null;
      for (let attempt = 1; attempt <= 2 && materials === null; attempt++) {
        try { await newChat(); materials = extractMaterials(await ask(buildPrompt(part))); }
        catch (error) { log(`❌ ${error.message}`); }
        if (materials === null && attempt === 1) log(`↻ Повторюю частину ${part.part} (${part.course}) — JSON не прочитався`);
      }
      if (materials === null) { run.failed.push(index); log(`✗ ${part.course} ч.${part.part}: не вдалося`); }
      else { run.materials.push(...materials); log(`✓ ${part.course} ч.${part.part}: +${materials.length}`); }
      run.done.push(index); saveRun(run);
    }
    bar(run.done.length, batch.parts.length);
    running = false; ui('stop').disabled = true;
    if (stopped) { status(`⏸ Пауза. Готово ${run.done.length}/${batch.parts.length}. Запусти з тим самим файлом — продовжить.`); return; }
    status(`✅ Готово! Матеріалів: ${run.materials.length}${run.failed.length ? `, не вдалося частин: ${run.failed.length}` : ''}`);
    download(run.materials);
    if (run.failed.length) {
      const failed = { ...batch, parts: run.failed.map((i) => batch.parts[i]), createdAt: batch.createdAt + '-retry' };
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(failed)], { type: 'application/json' }));
      a.download = 'zoshyt_classroom_повтор.json'; a.click();
      log('Невдалі частини збережено в zoshyt_classroom_повтор.json — можна запустити ще раз.');
    }
  }

  const fileInput = panel.querySelector('input[type=file]');
  ui('file').onclick = () => { if (!running) fileInput.click(); };
  fileInput.onchange = async () => {
    const file = fileInput.files[0]; fileInput.value = '';
    if (!file) return;
    try {
      const batch = JSON.parse(await file.text());
      if (batch.zoshitBatch !== 1 || !Array.isArray(batch.parts)) throw new Error();
      log(`📂 ${file.name}: частин ${batch.parts.length}`);
      await runBatch(batch);
    } catch (error) { status('❌ Це не файл zoshyt_classroom.json'); console.error(error); }
  };

  // ---------- збір з уже наявних чатів ----------
  ui('harvest').onclick = async () => {
    if (running) return;
    const chats = [];
    for (const a of document.querySelectorAll('a[href*="/app/"]')) {
      const id = (a.getAttribute('href').match(/\/app\/([0-9a-f]{8,})/i) || [])[1];
      if (id && !chats.some((c) => c.id === id)) chats.push({ id, title: a.innerText.trim().split('\n')[0] || id });
    }
    if (!chats.length) { status('❌ Чатів не знайдено — розгорни бічну панель і прокрути список.'); return; }
    const pick = prompt('Чати:\n' + chats.map((c, i) => `${i + 1}. ${c.title}`).join('\n') + '\n\nНомери (1,3), діапазон (1-20) або порожньо — усі:', '');
    if (pick === null) return;
    const nums = new Set();
    pick.split(/[ ,;]+/).filter(Boolean).forEach((part) => { const [a, b] = part.split('-').map(Number); for (let n = a; n <= (b || a); n++) nums.add(n); });
    const chosen = nums.size ? chats.filter((_, i) => nums.has(i + 1)) : chats;
    running = true;
    const all = [];
    for (const [i, chat] of chosen.entries()) {
      status(`⏳ ${i + 1}/${chosen.length}: ${chat.title}`); bar(i, chosen.length);
      document.querySelector(`a[href*="${chat.id}"]`)?.click();
      let found = null;
      for (let t = 0; t < 30 && !found; t++) {
        await wait(700);
        if (!location.pathname.includes(chat.id)) continue;
        const roots = responses();
        for (const root of roots) { const m = extractMaterials(root); if (m) found = [...(found || []), ...m]; }
      }
      if (found) { all.push(...found); log(`✓ ${chat.title}: +${found.length}`); } else log(`✗ ${chat.title}: JSON не знайдено`);
    }
    bar(1, 1); running = false;
    status(`✅ Зібрано матеріалів: ${all.length}`);
    download(all);
  };
  console.log('📒 Панель «Зошит × Gemini» відкрита справа внизу.');
})();
