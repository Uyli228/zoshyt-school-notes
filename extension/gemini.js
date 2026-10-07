// Gemini: бере чергу з Classroom, частинами робить конспекти й складає готові матеріали для «Зошита».
(() => {
  const { h } = Z;
  const sel = {
    input: ['rich-textarea .ql-editor', 'div.ql-editor[contenteditable="true"]', '[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]'],
    send: ['button.send-button', 'button[aria-label*="Send" i]', 'button[aria-label*="Надіслати" i]', 'button[aria-label*="Отправить" i]', 'button[data-test-id="send-button"]'],
    stop: ['button[aria-label*="Stop" i]', 'button[aria-label*="Зупин" i]', 'button[aria-label*="Остановить" i]', 'button.stop'],
    newChat: ['[data-test-id="new-chat-button"] a', '[data-test-id="new-chat-button"] button', '[data-test-id="new-chat-button"]', 'a[href="/app"]', 'button[aria-label*="New chat" i]', '[aria-label*="Новий чат" i]', '[aria-label*="Новый чат" i]']
  };
  const $q = (list) => { for (const s of list) { const el = document.querySelector(s); if (el) return el; } return null; };
  const responses = () => [...document.querySelectorAll('model-response')];
  let running = false, stopped = false;

  // ---------- підручники (зберігаються в IndexedDB цього сайту) ----------
  const db = () => new Promise((resolve, reject) => { const r = indexedDB.open('zoshit-textbooks', 1); r.onupgradeneeded = () => r.result.createObjectStore('books', { keyPath: 'name' }); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  const tx = async (mode, fn) => { const d = await db(); return new Promise((resolve, reject) => { const t = d.transaction('books', mode); const out = fn(t.objectStore('books')); t.oncomplete = () => resolve(out?.result); t.onerror = () => reject(t.error); }); };
  const listBooks = () => tx('readonly', (s) => s.getAll());
  const addBook = (file) => tx('readwrite', (s) => s.put({ name: file.name, type: file.type || 'application/pdf', blob: file }));
  const removeBook = (name) => tx('readwrite', (s) => s.delete(name));
  const bookFor = (books, subject) => { const stem = Z.norm(subject).split(' ')[0]?.slice(0, 5); return books.find((b) => stem && Z.norm(b.name).includes(stem)) || null; };

  // ---------- панель ----------
  const btn = 'padding:8px 10px;border:1px solid #ccc;border-radius:9px;background:#fff;color:#20243a;cursor:pointer;font:inherit';
  const fab = h('button', { style: 'position:fixed;right:16px;bottom:16px;z-index:2147483646;background:#6958d8;color:#fff;border:0;border-radius:99px;padding:10px 16px;font:700 13px system-ui,sans-serif;box-shadow:0 8px 24px #0004;cursor:pointer', onclick: () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; refresh(); } }, '📒 Зошит');
  const panel = h('div', { style: 'display:none;position:fixed;right:16px;bottom:64px;z-index:2147483646;width:350px;max-height:75vh;overflow:auto;background:#fff;color:#20243a;border:2px solid #6958d8;border-radius:14px;box-shadow:0 12px 40px #0004;font:13px/1.45 system-ui,sans-serif;padding:14px' });
  const body = h('div');
  const statusLine = h('div', { style: 'font-weight:600;margin-top:8px' });
  const barFill = h('i', { style: 'display:block;height:100%;width:0;background:#42a997' });
  const logBox = h('div', { style: 'margin-top:6px;font-size:12px;color:#555;white-space:pre-wrap' });
  const bookInput = h('input', { type: 'file', accept: '.pdf,application/pdf', multiple: true, hidden: true });
  panel.append(h('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, h('b', { style: 'font-size:15px' }, '📒 Зошит × Gemini'), h('button', { style: 'border:0;background:none;font-size:18px;cursor:pointer', onclick: () => { panel.style.display = 'none'; } }, '×')), body,
    h('div', { style: 'height:8px;background:#eee;border-radius:9px;margin:10px 0 0;overflow:hidden' }, barFill), statusLine, logBox, bookInput);
  document.body.append(fab, panel);
  const status = (text) => { statusLine.textContent = text; };
  const log = (text) => { logBox.textContent = (text + '\n' + logBox.textContent).slice(0, 4000); console.log('[Зошит]', text); };
  bookInput.onchange = async () => { for (const file of bookInput.files) await addBook(file); bookInput.value = ''; refresh(); };

  async function refresh() {
    const state = await Z.state();
    const books = await listBooks().catch(() => []);
    fab.textContent = state.queue.length ? `📒 Зошит · 🆕 ${state.queue.length}` : state.ready.length ? `📒 Зошит · ✅ ${state.ready.length}` : '📒 Зошит';
    const subjects = [...new Set(state.queue.map((item) => item.subject))];
    body.replaceChildren(
      h('div', { style: 'margin-top:8px' }, state.queue.length ? `У черзі нових пунктів: ${state.queue.length}` : 'Нових пунктів немає. Відкрий Classroom — я перевірю нові завдання.'),
      ...subjects.map((subject) => { const book = bookFor(books, subject); const count = state.queue.filter((i) => i.subject === subject).length; return h('div', { style: 'font-size:12px' }, `${book ? '📗' : '⚪'} ${subject}: ${count} ${book ? `· ${book.name}` : '· без підручника'}`); }),
      h('div', { style: 'display:flex;gap:6px;margin-top:8px' },
        h('button', { style: btn + ';flex:1;background:#6958d8;color:#fff;border:0;font-weight:700', disabled: running || !state.queue.length, onclick: () => run() }, running ? '⏳ Працюю…' : '▶ Обробити'),
        h('button', { style: btn, disabled: !running, onclick: () => { stopped = true; status('⏸ Зупиняюсь після поточного запиту…'); } }, '⏸')),
      state.ready.length ? h('button', { style: btn + ';width:100%;margin-top:6px;background:#e9f7f4;border-color:#42a997;font-weight:700', onclick: () => window.open(Z.SITE_URL + '#zoshit-import', '_blank') }, `✅ Готово ${state.ready.length} — відкрити «Зошит» та імпортувати`) : '',
      h('details', { style: 'margin-top:10px' }, h('summary', { style: 'cursor:pointer;font-weight:600' }, `📚 Підручники (${books.length})`),
        h('div', { style: 'font-size:12px;color:#555;margin:4px 0' }, 'PDF прикріплюється до запитів свого предмета, якщо назва файлу містить назву предмета (напр. «Фізика 9 клас.pdf»).'),
        ...books.map((b) => h('div', { style: 'display:flex;justify-content:space-between;font-size:12px' }, `📗 ${b.name}`, h('button', { style: 'border:0;background:none;cursor:pointer;color:#c33', onclick: async () => { await removeBook(b.name); refresh(); } }, '×'))),
        h('button', { style: btn + ';width:100%;margin-top:4px', onclick: () => bookInput.click() }, '＋ Додати PDF'),
        ...(state.textbooks.length ? [h('div', { style: 'font-size:12px;font-weight:600;margin-top:6px' }, 'Знайдено в Classroom (відкрий і завантаж):'), ...state.textbooks.map((t) => h('div', { style: 'font-size:12px' }, '• ', h('a', { href: t.url, target: '_blank', rel: 'noopener', style: 'color:#6958d8' }, `${t.subject}: ${t.name}`)))] : []))
    );
  }

  // ---------- робота з Gemini ----------
  async function newChat() {
    const before = location.pathname;
    const button = $q(sel.newChat);
    if (!button) { log('⚠ Не знайшов «Новий чат» — продовжую в цьому чаті.'); return; }
    button.click();
    for (let t = 0; t < 20; t++) { await Z.wait(500); if ((!responses().length && location.pathname !== before) || location.pathname === '/app') break; }
    await Z.wait(800);
  }
  async function attachFile(book) {
    const input = $q(sel.input);
    input.focus();
    const file = new File([book.blob], book.name, { type: book.type });
    const transfer = new DataTransfer(); transfer.items.add(file);
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
    for (let t = 0; t < 120; t++) {
      await Z.wait(1000);
      const shown = document.body.innerText.includes(book.name) || document.body.innerText.includes(book.name.replace(/\.pdf$/i, ''));
      const busy = document.querySelector('mat-progress-bar, [role="progressbar"], .uploading, [aria-busy="true"]');
      if (shown && !busy) { await Z.wait(1500); return true; }
    }
    log(`⚠ Не дочекався завантаження «${book.name}» — надсилаю без нього`);
    return false;
  }
  async function ask(text) {
    const input = $q(sel.input);
    if (!input) throw new Error('Не знайшов поле вводу Gemini');
    const count = responses().length;
    input.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
    await Z.wait(600);
    let send;
    for (let t = 0; t < 20; t++) { send = $q(sel.send); if (send && !send.disabled && send.getAttribute('aria-disabled') !== 'true') break; await Z.wait(300); }
    if (!send) throw new Error('Не знайшов кнопку надсилання');
    send.click();
    for (let t = 0; t < 120 && responses().length <= count; t++) await Z.wait(500);
    let last = '', same = 0;
    for (let t = 0; t < 360; t++) {
      await Z.wait(1500);
      const now = responses().at(-1)?.innerText || '';
      same = now && now === last && !$q(sel.stop) ? same + 1 : 0;
      last = now;
      if (same >= 3) break;
    }
    return responses().at(-1);
  }
  const extract = (root) => {
    if (!root) return null;
    const blocks = [...root.querySelectorAll('pre, code-block, code')].map((el) => el.innerText).filter((t) => /"materials"/.test(t));
    if (!blocks.length) { const text = root.innerText; const start = text.indexOf('{'); if (start >= 0 && /"materials"/.test(text)) blocks.push(text.slice(start, text.lastIndexOf('}') + 1)); }
    for (const block of blocks.reverse()) { try { const parsed = JSON.parse(block.trim()); if (Array.isArray(parsed.materials)) return parsed.materials; } catch { /* наступний */ } }
    return null;
  };
  const prompt = (subject, course, items, book) => `Ти готуєш конспекти для шкільної бібліотеки «Зошит». Нижче — пункти з Google Classroom (курс «${course}»).

1. ВІДБІР. Залиш тільки теорію: опрацювання / вивчення параграфа чи теми, теоретичні матеріали уроку. ВИКИНЬ: розв'язування задач, вправи, номери з підручника, тести, самостійні, контрольні, лабораторні, практичні, оголошення, порожні пункти.
   УВАГА: учитель часто пише «опрацювати §…» прямо в завданні разом із задачами чи вправами. Такий пункт ЗАЛИШ: зроби конспект параграфа, а задачі й вправи ігноруй.
${book ? `   ДЖЕРЕЛО: до повідомлення прикріплено підручник «${book.name}». Знайди в ньому потрібні параграфи (за номером § або назвою теми) і роби конспект САМЕ за текстом підручника — означення, формули й приклади звідти. Якщо параграфа в підручнику немає — пиши з власних знань.` : '   ДЖЕРЕЛО: підручник не прикріплено — пиши з власних знань за шкільною програмою України.'}
2. КОНСПЕКТ. Для кожного залишеного пункту — шкільний конспект українською, 200–600 слів. Оформлення Markdown: підзаголовки "### ", списки "- ", **жирним** ключові терміни. Формули — LaTeX між знаками долара: $F = ma$, окремим рядком $$E_k = \\frac{mv^2}{2}$$ (у JSON подвоюй зворотні слеші). Не вигадуй фактів; якщо тема незрозуміла — пропусти пункт.
3. КВІЗ І КАРТКИ. До кожного конспекту: квіз на 5 запитань (3–4 варіанти, answer — номер правильного варіанта від 0) і 6 флеш-карток (front — термін або запитання, мінімум 2 символи; back — відповідь).
4. РЕЗУЛЬТАТ. Поверни ЛИШЕ один блок коду json:
{"materials":[{"subject":"${subject}","topic":"розділ з Classroom","title":"§N. Назва теми без дати","summary":"одне речення","content":"конспект у Markdown","tags":["слово","слово"],"quiz":{"title":"Перевір себе","questions":[{"question":"…","options":["…","…","…"],"answer":0,"explanation":"…"}]},"flashcards":{"title":"Картки","cards":[{"front":"…","back":"…"}]}}]}
Якщо нічого не підходить — поверни {"materials":[]}. JSON має бути валідним.

ПУНКТИ:
${items.map((it, i) => `\n===== ${i + 1}. [${it.type}] ${it.title}\nРозділ: ${it.topic}\n${it.text || '(тексту немає — орієнтуйся на назву)'}${it.files?.length ? `\nВкладення: ${it.files.map((f) => f.name).join('; ')}` : ''}`).join('\n')}`;

  async function run() {
    if (running) return;
    running = true; stopped = false; refresh();
    const books = await listBooks().catch(() => []);
    const failedIds = new Set();
    let total = (await Z.state()).queue.length, doneCount = 0;
    try {
      while (!stopped) {
        const state = await Z.state();
        const pending = state.queue.filter((item) => !failedIds.has(item.id));
        if (!pending.length) break;
        const subject = pending[0].subject;
        const part = pending.filter((item) => item.subject === subject).slice(0, Z.PART_SIZE);
        barFill.style.width = `${total ? doneCount / total * 100 : 0}%`;
        status(`⏳ ${subject}: ${part.length} пункт(и), залишилось ${pending.length}`);
        let materials = null;
        for (let attempt = 1; attempt <= 2 && materials === null && !stopped; attempt++) {
          try {
            await newChat();
            const book = bookFor(books, subject);
            const attached = book ? await attachFile(book) : false;
            materials = extract(await ask(prompt(subject, part[0].course, part, attached ? book : null)));
          } catch (error) { log(`❌ ${error.message}`); }
          if (materials === null && attempt === 1) log(`↻ Повторюю (${subject}) — JSON не прочитався`);
        }
        const fresh = await Z.state();
        const ids = new Set(part.map((item) => item.id));
        if (materials === null) { part.forEach((item) => failedIds.add(item.id)); log(`✗ ${subject}: не вдалося, пункти лишаються в черзі`); }
        else {
          await Z.set({ ready: [...fresh.ready, ...materials], queue: fresh.queue.filter((item) => !ids.has(item.id)) });
          log(`✓ ${subject}: +${materials.length} конспект(ів) з ${part.length} пунктів`);
        }
        doneCount += part.length;
      }
    } finally {
      running = false;
      barFill.style.width = '100%';
      const state = await Z.state();
      status(stopped ? '⏸ Пауза. Натисни «Обробити», щоб продовжити.' : `✅ Готово! Матеріалів для «Зошита»: ${state.ready.length}${failedIds.size ? ` · не вдалося пунктів: ${failedIds.size}` : ''}`);
      refresh();
    }
  }

  chrome.storage.onChanged.addListener(() => { if (!running) refresh(); });
  refresh();
  if (location.hash.includes('zoshit-run')) { panel.style.display = 'block'; setTimeout(run, 2500); }
})();
