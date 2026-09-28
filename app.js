const STORAGE_KEY = 'tetrad-library-v1';
const PREFS_KEY = 'zoshit-reader-preferences-v1';
const colors = [
  { color: '#7969dd', tint: '#f0edff' }, { color: '#42a997', tint: '#e9f7f4' },
  { color: '#e8a04e', tint: '#fff4e7' }, { color: '#e17082', tint: '#fff0f2' },
  { color: '#4f91c8', tint: '#edf6ff' }, { color: '#8c9b59', tint: '#f1f5e9' }
];
const starter = [
  { id: 'biology', name: 'Біологія', icon: '🌿', color: colors[1].color, tint: colors[1].tint, topics: [
    { id: 'cells', name: 'Клітина та її будова', description: 'Основні частини клітини та їхні функції', paragraphs: [
      { id: 'cell-1', name: 'Клітинна мембрана', summary: 'Як влаштована оболонка клітини та для чого вона потрібна.', content: 'Клітинна мембрана відокремлює вміст клітини від зовнішнього середовища. Вона складається з подвійного шару ліпідів і білків.\n\nМембрана вибірково пропускає речовини: одні проходять вільно, для інших потрібні спеціальні білки-переносники. Так клітина підтримує сталість внутрішнього середовища.', image: '' },
      { id: 'cell-2', name: 'Органели клітини', summary: 'Коротко про головні структури всередині клітини.', content: 'Ядро зберігає спадкову інформацію. Мітохондрії беруть участь в отриманні енергії, а рибосоми утворюють білки.\n\nУ рослинних клітинах також є хлоропласти для фотосинтезу та велика центральна вакуоля.', image: '' }
    ]},
    { id: 'plants', name: 'Рослинна клітина', description: 'Особливості клітин рослин', paragraphs: [
      { id: 'plant-1', name: 'Чим відрізняється рослинна клітина', summary: 'Клітинна стінка, хлоропласти та вакуоля.', content: 'Рослинна клітина оточена міцною клітинною стінкою з целюлози. У хлоропластах відбувається фотосинтез, а центральна вакуоля зберігає воду й розчинені речовини.', image: '' }
    ]}
  ]},
  { id: 'history', name: 'Історія', icon: '🏛️', color: colors[0].color, tint: colors[0].tint, topics: [
    { id: 'ancient', name: 'Стародавній світ', description: 'Перші цивілізації та держави', paragraphs: [
      { id: 'egypt', name: 'Стародавній Єгипет', summary: 'Ніл, фараони та устрій суспільства.', content: 'Стародавньоєгипетська цивілізація виникла в долині Нілу. Розливи річки залишали родючий мул, завдяки якому розвивалося землеробство.\n\nНа чолі держави стояв фараон. Писарі використовували ієрогліфічне письмо, а для будівництва храмів і пірамід організовували великі колективи працівників.', image: '' }
    ]}
  ]},
  { id: 'math', name: 'Математика', icon: '📐', color: colors[2].color, tint: colors[2].tint, topics: [
    { id: 'fractions', name: 'Звичайні дроби', description: 'Запис, порівняння та дії з дробами', paragraphs: [
      { id: 'frac-1', name: 'Додавання дробів', summary: 'Як додавати дроби з однаковими та різними знаменниками.', content: 'Якщо знаменники однакові, додаємо чисельники, а знаменник залишаємо без змін.\n\nЯкщо знаменники різні, спочатку зводимо дроби до спільного знаменника. Наприклад: 1/2 + 1/3 = 3/6 + 2/6 = 5/6.\n\nПісля обчислення скороти дріб, якщо чисельник і знаменник діляться на одне число.', image: '' }
    ]}
  ]}
];
let data = loadData();
let readerPrefs = loadReaderPrefs();
const cloudConfig = window.ZOSHIT_SUPABASE_CONFIG || {};
const cloudConfigured = Boolean(cloudConfig.url && cloudConfig.anonKey && window.supabase?.createClient);
let cloudClient = null;
let cloudReady = false;
let isAdmin = false;
let sharedRevision = 0;
let realtimeChannel = null;
let currentUser = null;
let pendingSubmissionCount = 0;
let activeScreen = 'library';
let submissionQueryGeneration = 0;
let classroomAccessToken = '';
let classroomCourses = [];
let classroomPreview = [];
let bulkImportRows = [];
let reportTarget = null;
let cloudError = '';
let current = { subjectId: null, topicId: null, paragraphId: null };
let editContext = null;
let toastTimer;
const $ = (selector) => document.querySelector(selector);
const view = $('#view');

function loadData() {
  try { const saved = localStorage.getItem(STORAGE_KEY); return saved ? JSON.parse(saved) : structuredClone(starter); }
  catch { return structuredClone(starter); }
}
function loadReaderPrefs() {
  try {
    const value = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return { favorites: Array.isArray(value.favorites) ? value.favorites : [], read: value.read && typeof value.read === 'object' ? value.read : {}, notes: value.notes && typeof value.notes === 'object' ? value.notes : {}, recent: Array.isArray(value.recent) ? value.recent : [] };
  } catch { return { favorites: [], read: {}, notes: {}, recent: [] }; }
}
function saveReaderPrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(readerPrefs)); return true; }
  catch { notify('Не вдалося зберегти особисті налаштування на цьому пристрої.'); return false; }
}
function findParagraph(paragraphId) {
  for (const sub of data) for (const top of sub.topics) {
    const item = top.paragraphs.find((entry) => entry.id === paragraphId);
    if (item) return { sub, top, paragraph: item };
  }
  return null;
}
function openParagraph(sub, top, p) {
  current = { subjectId: sub.id, topicId: top.id, paragraphId: p.id };
  readerPrefs.recent = [p.id, ...readerPrefs.recent.filter((id) => id !== p.id)].slice(0, 12);
  saveReaderPrefs();
  render();
}
async function saveData() {
  if (!cloudConfigured) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
    catch { notify('Не вдалося зберегти дані. Спробуй зменшити зображення.'); return false; }
  }
  if (!cloudReady || !isAdmin) { notify('Змінювати спільну бібліотеку може лише адміністратор.'); return false; }
  const nextRevision = sharedRevision + 1;
  const { data: saved, error } = await cloudClient.from('library_documents')
    .update({ data, revision: nextRevision, updated_at: new Date().toISOString() })
    .eq('id', 1).eq('revision', sharedRevision).select('revision').maybeSingle();
  if (error) { notify('Не вдалося зберегти спільну бібліотеку. Перевір з’єднання.'); console.error(error); return false; }
  if (!saved) { notify('Бібліотеку вже змінив інший адміністратор. Онови сторінку й повтори дію.'); await loadSharedLibrary(); return false; }
  sharedRevision = Number(saved.revision);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* Хмарна копія вже збережена. */ }
  return true;
}
function canManage() { return !cloudConfigured || (cloudReady && isAdmin); }
function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function subject(id) { return data.find((item) => item.id === id); }
function topic(sub, id) { return sub?.topics.find((item) => item.id === id); }
function paragraph(top, id) { return top?.paragraphs.find((item) => item.id === id); }
function esc(value = '') { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function safeHttpUrl(value = '') { try { const url = new URL(String(value)); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''; } catch { return ''; } }
function notify(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600); }
function renderAccessState() {
  const account = $('#accountButton');
  account.textContent = currentUser ? (isAdmin ? 'Адміністратор · вийти' : 'Вийти') : 'Увійти';
  account.title = currentUser ? 'Вийти з облікового запису' : 'Увійти, щоб запропонувати конспект';
  const submitButton = $('#submitNotesButton');
  submitButton.textContent = isAdmin ? `Пропозиції${pendingSubmissionCount ? ` · ${pendingSubmissionCount}` : ''}` : 'Запропонувати конспект';
  submitButton.title = isAdmin ? 'Переглянути конспекти на перевірці' : 'Надіслати конспект на перевірку';
  submitButton.disabled = !cloudReady;
  $('#classroomImportButton').hidden = !(cloudReady && isAdmin);
  $('#importButton').hidden = !canManage();
  $('#csvImportButton').hidden = !canManage();
  $('#reportsButton').hidden = !(cloudReady && isAdmin);
  const note = $('#storageNote');
  note.innerHTML = cloudConfigured
    ? '<span class="storage-dot"></span><span>Спільна бібліотека<br>для всіх читачів</span>'
    : '<span class="storage-dot storage-dot-local"></span><span>Локальний режим<br>без синхронізації</span>';
  renderSystemBanner();
}
function renderSystemBanner() {
  const banner = $('#systemBanner');
  if (!cloudConfigured) {
    banner.className = 'system-banner system-banner-warn';
    banner.textContent = 'Зараз це локальна копія: зміни видно лише в цьому браузері. Підключи Supabase, щоб увімкнути спільну бібліотеку й доступ адміністратора.';
    banner.hidden = false;
    return;
  }
  if (!cloudReady) {
    banner.className = 'system-banner system-banner-warn';
    banner.textContent = cloudError || 'Не вдалося під’єднатися до спільної бібліотеки. Перевір налаштування Supabase.';
    banner.hidden = false;
    return;
  }
  if (isAdmin && data.length === 0 && loadData().length > 0) {
    banner.className = 'system-banner system-banner-info';
    banner.innerHTML = 'Знайдено матеріали, збережені в цьому браузері. <button class="text-button" id="migrateLocal">Перенести їх у спільну бібліотеку</button>';
    banner.hidden = false;
    $('#migrateLocal').onclick = migrateLocalLibrary;
    return;
  }
  banner.hidden = true;
  banner.textContent = '';
}
async function loadSharedLibrary() {
  const { data: row, error } = await cloudClient.from('library_documents').select('data,revision').eq('id', 1).single();
  if (error) throw error;
  if (!Array.isArray(row.data)) throw new Error('Спільна бібліотека має некоректний формат.');
  data = row.data;
  sharedRevision = Number(row.revision);
  cloudReady = true;
  cloudError = '';
}
async function updateAdminRole(user, announce = false) {
  currentUser = user || null;
  isAdmin = false;
  if (user && cloudClient) {
    const { data: role, error } = await cloudClient.from('library_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (error) { console.error(error); cloudError = 'Не вдалося перевірити права адміністратора.'; }
    isAdmin = Boolean(role);
    if (announce && !isAdmin) notify('Вхід виконано. Тепер можна надсилати конспекти на перевірку.');
  }
  if (!isAdmin) classroomAccessToken = '';
  await loadPendingSubmissionCount();
  renderAccessState();
  render();
}
async function loadPendingSubmissionCount() {
  pendingSubmissionCount = 0;
  if (!isAdmin || !cloudClient) return;
  const { count, error } = await cloudClient.from('library_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  if (error) { console.error(error); return; }
  pendingSubmissionCount = count || 0;
}
async function migrateLocalLibrary() {
  if (!isAdmin || !cloudReady) return;
  const localCopy = loadData();
  if (!localCopy.length || !confirm(`Перенести ${localCopy.length} предметів із цього браузера у спільну бібліотеку?`)) return;
  const previousData = data;
  data = localCopy;
  if (!await saveData()) data = previousData;
  else notify('Матеріали перенесено. Тепер вони доступні всім.');
  render();
}
async function initializeApp() {
  if (!cloudConfigured) { cloudReady = false; renderAccessState(); render(); return; }
  cloudClient = window.supabase.createClient(cloudConfig.url, cloudConfig.anonKey);
  try {
    await loadSharedLibrary();
    const { data: { session } } = await cloudClient.auth.getSession();
    await updateAdminRole(session?.user, false);
    cloudClient.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => updateAdminRole(session?.user, true), 0);
    });
    realtimeChannel = cloudClient.channel('shared-library-updates').on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'library_documents', filter: 'id=eq.1' },
      (payload) => {
        if (Array.isArray(payload.new?.data) && Number(payload.new.revision) > sharedRevision) {
          data = payload.new.data;
          sharedRevision = Number(payload.new.revision);
          render();
          renderAccessState();
        }
      }).subscribe();
    cloudClient.channel('library-submission-updates').on('postgres_changes',
      { event: '*', schema: 'public', table: 'library_submissions' },
      async () => {
        if (isAdmin) {
          await loadPendingSubmissionCount();
          renderAccessState();
          if (activeScreen === 'submissions') renderSubmissionQueue();
        }
      }).subscribe();
  } catch (error) {
    console.error(error);
    cloudReady = false;
    cloudError = 'Спільна бібліотека ще не налаштована або недоступна. Перевір проєкт Supabase та виконай supabase/schema.sql.';
    data = [];
    renderAccessState();
    render();
  }
}
async function requestAdminLink(event) {
  event.preventDefault();
  if (!cloudReady) { notify('Спочатку потрібно під’єднати проєкт Supabase.'); return; }
  const email = String(new FormData(event.currentTarget).get('email') || '').trim();
  const { error } = await cloudClient.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}${location.pathname}` } });
  if (error) {
    console.error('Помилка входу Supabase:', error);
    const code = String(error.code || '');
    if (code === 'email_address_not_authorized') {
      notify('Supabase поки не дозволяє надсилати листи на цю адресу. Власнику сайту потрібно налаштувати SMTP у Supabase.');
    } else if (code === 'over_email_send_rate_limit' || error.status === 429) {
      notify('Supabase тимчасово обмежив надсилання листів. Спробуй пізніше.');
    } else if (code === 'redirect_to_not_allowed') {
      notify('Адреса сайту не додана до дозволених адрес входу в Supabase.');
    } else {
      notify('Supabase не зміг надіслати лист. Власнику сайту потрібно перевірити налаштування пошти; точну помилку записано в консолі браузера.');
    }
    return;
  }
  $('#authDialog').close();
  event.currentTarget.reset();
  notify('Посилання для входу надіслано на пошту. Після входу можна буде надіслати конспект.');
}
async function signInWithGoogle() {
  if (!cloudReady) { notify('Спільна бібліотека зараз недоступна. Спробуй пізніше.'); return; }
  const { error } = await cloudClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}${location.pathname}` }
  });
  if (error) {
    console.error('Помилка входу Google:', error);
    notify('Не вдалося увійти через Google. Перевір налаштування Google у Supabase.');
  }
}
async function handleAccountButton() {
  if (currentUser) {
    await cloudClient.auth.signOut();
    await updateAdminRole(null, false);
  } else if (cloudConfigured) $('#authDialog').showModal();
  else notify('Вхід стане доступним після підключення спільної бібліотеки.');
}
function openReportDialog(sub, top, p) {
  if (!cloudReady) { notify('Зараз повідомлення недоступні. Спробуй пізніше.'); return; }
  if (!currentUser) { notify('Увійди, щоб надіслати повідомлення модератору.'); $('#authDialog').showModal(); return; }
  reportTarget = { sub, top, p };
  $('#reportContext').textContent = `${sub.name} · ${top.name} · ${p.name}`;
  $('#reportForm').reset();
  $('#reportDialog').showModal();
}
async function submitLibraryReport(event) {
  event.preventDefault();
  if (!currentUser || !reportTarget) { notify('Увійди, щоб надіслати повідомлення.'); return; }
  const { sub, top, p } = reportTarget;
  const { error } = await cloudClient.from('library_reports').insert({
    author_id: currentUser.id, subject_name: sub.name, topic_name: top.name,
    paragraph_id: p.id, paragraph_title: p.name, message: $('#reportMessage').value.trim()
  });
  if (error) { console.error(error); notify(error.code === 'P0001' ? 'Забагато повідомлень за короткий час. Спробуй пізніше.' : 'Не вдалося надіслати повідомлення. Перевір з’єднання й спробуй ще раз.'); return; }
  $('#reportDialog').close(); reportTarget = null;
  notify('Дякуємо! Повідомлення надіслано адміністратору.');
}
async function renderReportQueue() {
  if (!isAdmin || !cloudClient) { activeScreen = 'library'; render(); return; }
  setBreadcrumbs([{ label: 'Спільна бібліотека', action: 'home' }, { label: 'Повідомлення про помилки' }]);
  view.innerHTML = '<div class="page-heading"><div><span class="eyebrow">ЗВОРОТНИЙ ЗВ’ЯЗОК</span><h1>Повідомлення про помилки</h1><p>Переглядай зауваження до матеріалів бібліотеки.</p></div><button class="button button-quiet" id="backToLibrary">До бібліотеки</button></div><div class="empty-state"><p>Завантажую повідомлення…</p></div>';
  $('#backToLibrary').onclick = () => { activeScreen = 'library'; render(); };
  const { data: reports, error } = await cloudClient.from('library_reports').select('id,subject_name,topic_name,paragraph_title,message,created_at,status').order('created_at', { ascending: false });
  if (activeScreen !== 'reports') return;
  if (error) {
    console.error(error);
    view.innerHTML = '<div class="empty-state"><h3>Не вдалося завантажити повідомлення</h3><p>Перевір Supabase та виконай оновлений файл supabase/submissions.sql.</p></div>';
    return;
  }
  view.innerHTML = `<div class="page-heading"><div><span class="eyebrow">ЗВОРОТНИЙ ЗВ’ЯЗОК</span><h1>Повідомлення про помилки</h1><p>${reports.filter((r) => r.status === 'pending').length} очікують перевірки.</p></div><button class="button button-quiet" id="backToLibrary">До бібліотеки</button></div>${reports.length ? `<div class="submission-list">${reports.map((report) => `<article class="submission-card"><div class="submission-meta"><span>${esc(report.subject_name)} › ${esc(report.topic_name)} › ${esc(report.paragraph_title)}</span><time>${new Date(report.created_at).toLocaleDateString('uk-UA')}</time></div><p class="report-message">${esc(report.message)}</p>${report.status === 'pending' ? `<div class="submission-actions"><button class="button button-primary" data-resolve-report="${esc(report.id)}">Позначити вирішеним</button></div>` : '<span class="report-resolved">✓ Вирішено</span>'}</article>`).join('')}</div>` : '<div class="empty-state"><div class="empty-icon">✅</div><h3>Повідомлень поки немає</h3><p>Зауваження до матеріалів з’являться тут.</p></div>'}`;
  $('#backToLibrary').onclick = () => { activeScreen = 'library'; render(); };
  view.querySelectorAll('[data-resolve-report]').forEach((button) => button.addEventListener('click', async () => {
    const { error: updateError } = await cloudClient.from('library_reports').update({ status: 'resolved', reviewed_at: new Date().toISOString(), reviewer_id: currentUser.id }).eq('id', button.dataset.resolveReport);
    if (updateError) { console.error(updateError); notify('Не вдалося оновити повідомлення.'); return; }
    renderReportQueue();
  }));
}
function startCsvImport() {
  if (!canManage()) { notify('Додавати матеріали може лише адміністратор.'); return; }
  bulkImportRows = [];
  $('#csvImportHint').textContent = 'Завантаж приклад або вибери свою таблицю.';
  $('#csvImportPreview').innerHTML = '';
  $('#confirmCsvImport').disabled = true;
  $('#csvImportFileVisible').value = '';
  $('#csvImportDialog').showModal();
}
function parseCsv(text) {
  const source = text.replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] || '';
  const delimiters = [';', ',', '\t'];
  const delimiter = delimiters.map((candidate) => ({ candidate, count: firstLine.split(candidate).length - 1 })).sort((a, b) => b.count - a.count)[0].candidate;
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '"' && quoted && source[index + 1] === '"') { cell += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[index + 1] === '\n') index++;
      row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) throw new Error('У таблиці немає рядків із матеріалами.');
  const headers = rows.shift().map((value) => value.trim().toLocaleLowerCase('uk').replace(/[ _-]+/g, ''));
  const column = (names) => headers.findIndex((header) => names.includes(header));
  const columns = {
    subject: column(['предмет', 'клас', 'subject']), topic: column(['тема', 'topic']),
    title: column(['назва', 'параграф', 'title']), summary: column(['опис', 'короткийопис', 'summary']),
    content: column(['конспект', 'текст', 'нотатки', 'content']), tags: column(['теги', 'tags'])
  };
  if (columns.subject < 0 || columns.topic < 0 || columns.title < 0) throw new Error('Не знайшов обов’язкові стовпці: предмет, тема й назва.');
  const parsed = rows.map((values, index) => ({
    line: index + 2,
    subject: String(values[columns.subject] || '').trim(), topic: String(values[columns.topic] || '').trim(),
    title: String(values[columns.title] || '').trim(), summary: columns.summary < 0 ? '' : String(values[columns.summary] || '').trim(),
    content: columns.content < 0 ? '' : String(values[columns.content] || '').trim(),
    tags: columns.tags < 0 ? [] : String(values[columns.tags] || '').split(/[|;]/).map((tag) => tag.trim()).filter(Boolean)
  }));
  const invalid = parsed.filter((item) => !item.subject || !item.topic || !item.title);
  if (invalid.length) throw new Error(`У рядках ${invalid.slice(0, 5).map((item) => item.line).join(', ')} бракує предмета, теми або назви.`);
  if (parsed.length > 1000) throw new Error('За один раз можна додати не більше 1000 рядків.');
  return parsed;
}
async function previewCsvFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { bulkImportRows = []; $('#confirmCsvImport').disabled = true; $('#csvImportPreview').innerHTML = ''; $('#csvImportHint').textContent = 'CSV-файл має бути меншим за 10 МБ.'; return; }
  try {
    bulkImportRows = parseCsv(await file.text());
    $('#csvImportHint').textContent = `Знайдено ${bulkImportRows.length} рядків. Переглянь перші матеріали й підтвердь імпорт.`;
    $('#csvImportPreview').innerHTML = `<ul>${bulkImportRows.slice(0, 12).map((row) => `<li><strong>${esc(row.subject)} › ${esc(row.topic)} › ${esc(row.title)}</strong>${row.tags.length ? `<small>${row.tags.map((tag) => `#${esc(tag)}`).join(' ')}</small>` : ''}</li>`).join('')}</ul>${bulkImportRows.length > 12 ? `<small>Інші ${bulkImportRows.length - 12} рядків теж буде імпортовано.</small>` : ''}`;
    $('#confirmCsvImport').disabled = false;
  } catch (error) {
    bulkImportRows = [];
    $('#confirmCsvImport').disabled = true;
    $('#csvImportHint').textContent = error.message || 'Не вдалося прочитати цю таблицю.';
  }
}
function downloadCsvTemplate() {
  const csv = '\uFEFFпредмет;тема;назва;опис;конспект;теги\r\nБіологія;Клітина;Будова клітини;Основні частини клітини;Ядро зберігає спадкову інформацію.;важливо|контрольна\r\n';
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = 'zoshit-import-example.csv'; link.click(); URL.revokeObjectURL(link.href);
}
async function importCsvRows() {
  if (!canManage() || !bulkImportRows.length) return;
  const previousData = structuredClone(data);
  let added = 0, skipped = 0;
  for (const row of bulkImportRows) {
    let sub = data.find((item) => item.name.trim().toLocaleLowerCase('uk') === row.subject.toLocaleLowerCase('uk'));
    if (!sub) { const color = colors[data.length % colors.length]; sub = { id: uid(), name: row.subject, icon: '📚', color: color.color, tint: color.tint, topics: [] }; data.push(sub); }
    let top = sub.topics.find((item) => item.name.trim().toLocaleLowerCase('uk') === row.topic.toLocaleLowerCase('uk'));
    if (!top) { top = { id: uid(), name: row.topic, description: '', paragraphs: [] }; sub.topics.push(top); }
    if (top.paragraphs.some((item) => item.name.trim().toLocaleLowerCase('uk') === row.title.toLocaleLowerCase('uk'))) { skipped++; continue; }
    top.paragraphs.push({ id: uid(), name: row.title, summary: row.summary, content: row.content, tags: row.tags, image: '', updatedAt: new Date().toISOString(), history: [] }); added++;
  }
  if (!await saveData()) { data = previousData; return; }
  $('#csvImportDialog').close(); activeScreen = 'library'; current = { subjectId: null, topicId: null, paragraphId: null }; render();
  notify(`Додано ${added}, пропущено дублікатів: ${skipped}.`);
}
function counts(sub) { return { topics: sub.topics.length, paragraphs: sub.topics.reduce((sum, item) => sum + item.paragraphs.length, 0) }; }
function renderNav() {
  $('#addSubject').hidden = !canManage();
  $('#subjectNav').innerHTML = data.map((sub) => {
    const count = counts(sub).paragraphs;
    return `<button class="subject-link ${current.subjectId === sub.id ? 'active' : ''}" data-subject="${esc(sub.id)}"><span class="subject-icon">${esc(sub.icon || '📚')}</span><span>${esc(sub.name)}</span><span class="subject-count">${count}</span></button>`;
  }).join('');
  $('#subjectNav').querySelectorAll('[data-subject]').forEach((el) => el.addEventListener('click', () => { current = { subjectId: el.dataset.subject, topicId: null, paragraphId: null }; render(); }));
}
function setBreadcrumbs(items) {
  $('#breadcrumbs').innerHTML = items.map((item, index) => `${index ? '<span class="crumb-sep">/</span>' : ''}${item.action ? `<button data-crumb="${item.action}">${esc(item.label)}</button>` : `<strong>${esc(item.label)}</strong>`}`).join('');
  $('#breadcrumbs').querySelectorAll('[data-crumb]').forEach((el) => el.addEventListener('click', () => {
    if (el.dataset.crumb === 'home') { activeScreen = 'library'; current = { subjectId: null, topicId: null, paragraphId: null }; }
    if (el.dataset.crumb === 'subject') current.topicId = current.paragraphId = null;
    if (el.dataset.crumb === 'topic') current.paragraphId = null;
    render();
  }));
}
function render() { renderNav(); if (activeScreen === 'submissions') return renderSubmissionQueue(); if (activeScreen === 'reports') return renderReportQueue(); if (!current.subjectId) return renderHome(); const sub = subject(current.subjectId); if (!sub) { current = { subjectId: null, topicId: null, paragraphId: null }; return render(); } if (!current.topicId) return renderSubject(sub); const top = topic(sub, current.topicId); if (!top) { current.topicId = null; return render(); } if (!current.paragraphId) return renderTopic(sub, top); const para = paragraph(top, current.paragraphId); if (!para) { current.paragraphId = null; return render(); } renderParagraph(sub, top, para); }
function renderPersonalLists() {
  const list = (title, ids, icon) => {
    const entries = ids.map((id) => findParagraph(id)).filter(Boolean);
    if (!entries.length) return '';
    return `<section class="personal-section"><div class="section-title"><h2>${icon} ${title}</h2><span>${entries.length}</span></div><div class="personal-list">${entries.map(({ sub, top, paragraph: p }) => `<button class="personal-item" data-personal-paragraph="${esc(p.id)}"><span><strong>${esc(p.name)}</strong><small>${esc(sub.name)} › ${esc(top.name)}</small></span><span class="personal-status">${readerPrefs.read[p.id] ? '✓ Прочитано' : 'Не прочитано'}</span></button>`).join('')}</div></section>`;
  };
  const favorites = list('Обране', readerPrefs.favorites, '', '★');
  const recent = list('Нещодавно відкриті', readerPrefs.recent, '', '↺');
  return favorites + recent;
}
function renderHome() {
  setBreadcrumbs([{ label: 'Спільна бібліотека' }]);
  const totalTopics = data.reduce((sum, sub) => sum + sub.topics.length, 0);
  const totalParas = data.reduce((sum, sub) => sum + counts(sub).paragraphs, 0);
  view.innerHTML = `<div class="welcome-row"><div><span class="eyebrow">ТВОЄ МІСЦЕ ДЛЯ ЗНАНЬ</span><h1>Усе важливе — поруч</h1><p>Спільна бібліотека для повторення матеріалів з усіх предметів.</p></div>${canManage()?'<button class="button button-primary" id="homeAddSubject">＋ &nbsp;Додати предмет</button>':''}</div>
    <div class="overview-grid"><div class="stat-card"><span class="stat-icon">📚</span><div><div class="stat-number">${data.length}</div><div class="stat-label">предметів</div></div></div><div class="stat-card"><span class="stat-icon">🗂️</span><div><div class="stat-number">${totalTopics}</div><div class="stat-label">тем</div></div></div><div class="stat-card"><span class="stat-icon">✍️</span><div><div class="stat-number">${totalParas}</div><div class="stat-label">параграфів</div></div></div></div>
    <div class="section-title"><h2>Предмети</h2><span>${data.length ? 'Обери, що повторити' : 'Почни з першого предмета'}</span></div>
    ${data.length ? `<div class="subject-grid">${data.map((sub) => { const c = counts(sub); return `<article class="subject-card" data-open-subject="${esc(sub.id)}" style="--card-color:${esc(sub.color)};--card-tint:${esc(sub.tint)}"><div class="card-band"></div><div class="subject-card-body"><div class="card-top"><span class="card-emoji">${esc(sub.icon || '📚')}</span>${canManage()?`<button class="more-button" data-edit-subject="${esc(sub.id)}" aria-label="Налаштувати предмет ${esc(sub.name)}">···</button>`:''}</div><h3>${esc(sub.name)}</h3><div class="card-meta">${c.topics} ${plural(c.topics, 'тема', 'теми', 'тем')}</div><div class="subject-card-foot"><span>${c.paragraphs} ${plural(c.paragraphs, 'параграф', 'параграфи', 'параграфів')}</span><b>Відкрити →</b></div></div></article>`; }).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">📖</div><h3>${canManage()?'Спільна бібліотека поки порожня':'У бібліотеці поки немає предметів'}</h3><p>${canManage()?'Додай предмет або перенеси матеріали, збережені раніше в цьому браузері.':'Адміністратор ще не додав навчальні матеріали.'}</p>${canManage()?'<button class="button button-primary" id="emptyAddSubject">＋ Додати предмет</button>':''}</div>`}`;
  view.insertAdjacentHTML('beforeend', renderPersonalLists());
  $('#homeAddSubject')?.addEventListener('click', () => openEditor('subject'));
  $('#emptyAddSubject')?.addEventListener('click', () => openEditor('subject'));
  view.querySelectorAll('[data-open-subject]').forEach((el) => el.addEventListener('click', () => { current = { subjectId: el.dataset.openSubject, topicId: null, paragraphId: null }; render(); }));
  view.querySelectorAll('[data-edit-subject]').forEach((el) => el.addEventListener('click', (event) => { event.stopPropagation(); openEditor('subject', el.dataset.editSubject); }));
  view.querySelectorAll('[data-personal-paragraph]').forEach((el) => el.addEventListener('click', () => { const found = findParagraph(el.dataset.personalParagraph); if (found) openParagraph(found.sub, found.top, found.paragraph); }));
}
function plural(n, one, few, many) { const n10=n%10,n100=n%100; return n10===1&&n100!==11?one:n10>=2&&n10<=4&&(n100<12||n100>14)?few:many; }
async function openSubmissionFlow() {
  if (!cloudReady) { notify('Спільна бібліотека зараз недоступна. Спробуй пізніше.'); return; }
  if (isAdmin) {
    activeScreen = 'submissions';
    current = { subjectId: null, topicId: null, paragraphId: null };
    await renderSubmissionQueue();
    return;
  }
  if (!currentUser) { $('#authDialog').showModal(); return; }
  const options = $('#subjectOptions');
  options.innerHTML = data.map((item) => `<option value="${esc(item.name)}"></option>`).join('');
  $('#submissionSubject').value = subject(current.subjectId)?.name || '';
  $('#submissionTopic').value = topic(subject(current.subjectId), current.topicId)?.name || '';
  $('#submissionForm').reset();
  const imagePreview = $('#submissionImagePreview');
  imagePreview.src = '';
  imagePreview.style.display = 'none';
  delete imagePreview.dataset.newImage;
  $('#submissionSubject').value = subject(current.subjectId)?.name || '';
  $('#submissionTopic').value = topic(subject(current.subjectId), current.topicId)?.name || '';
  $('#submissionDialog').showModal();
  $('#submissionSubject').focus();
}
async function renderSubmissionQueue() {
  if (!isAdmin || !cloudClient) { activeScreen = 'library'; render(); return; }
  const generation = ++submissionQueryGeneration;
  setBreadcrumbs([{ label: 'Спільна бібліотека', action: 'home' }, { label: 'Пропозиції' }]);
  view.innerHTML = '<div class="page-heading"><div><span class="eyebrow">МОДЕРАЦІЯ</span><h1>Пропозиції конспектів</h1><p>Перевір матеріал перед публікацією у спільній бібліотеці.</p></div></div><div class="empty-state"><p>Завантажую пропозиції…</p></div>';
  const { data: submissions, error } = await cloudClient.from('library_submissions')
    .select('id,subject_name,topic_name,title,summary,content,image_data,created_at')
    .eq('status', 'pending').order('created_at', { ascending: true });
  if (generation !== submissionQueryGeneration || activeScreen !== 'submissions') return;
  if (error) {
    console.error(error);
    view.innerHTML = '<div class="empty-state"><h3>Не вдалося завантажити пропозиції</h3><p>Перевір підключення до Supabase та спробуй ще раз.</p><button class="button button-primary" id="retrySubmissions">Оновити</button></div>';
    $('#retrySubmissions').onclick = renderSubmissionQueue;
    return;
  }
  pendingSubmissionCount = submissions.length;
  renderAccessState();
  view.innerHTML = `<div class="page-heading"><div><span class="eyebrow">МОДЕРАЦІЯ</span><h1>Пропозиції конспектів</h1><p>${submissions.length ? 'Перевір матеріал перед публікацією у спільній бібліотеці.' : 'Нових пропозицій поки немає.'}</p></div></div>${submissions.length ? `<div class="submission-list">${submissions.map((item) => `<article class="submission-card"><div class="submission-meta"><span>${esc(item.subject_name)} <b>›</b> ${esc(item.topic_name)}</span><time>${new Date(item.created_at).toLocaleDateString('uk-UA')}</time></div><h2>${esc(item.title)}</h2>${item.summary ? `<p class="article-summary">${esc(item.summary)}</p>` : ''}${item.image_data ? `<img class="submission-image" src="${esc(item.image_data)}" alt="Зображення до пропозиції ${esc(item.title)}">` : ''}<details><summary>Переглянути конспект</summary><div class="submission-content">${esc(item.content)}</div></details><div class="submission-actions"><button class="button button-quiet" data-reject-submission="${esc(item.id)}">Відхилити</button><button class="button button-primary" data-approve-submission="${esc(item.id)}">Опублікувати</button></div></article>`).join('')}</div>` : '<div class="empty-state"><div class="empty-icon">✅</div><h3>Усе перевірено</h3><p>Коли учні надішлють нові конспекти, вони з’являться тут.</p></div>'}`;
  view.querySelectorAll('[data-approve-submission]').forEach((button) => button.addEventListener('click', () => reviewSubmission(button.dataset.approveSubmission, true)));
  view.querySelectorAll('[data-reject-submission]').forEach((button) => button.addEventListener('click', () => reviewSubmission(button.dataset.rejectSubmission, false)));
}
async function reviewSubmission(id, approve) {
  if (!isAdmin) return;
  const { error } = await cloudClient.rpc('review_library_submission', { p_submission_id: id, p_approve: approve });
  if (error) {
    console.error(error);
    notify('Не вдалося оновити пропозицію. Перевір права бази даних.');
    return;
  }
  if (approve) await loadSharedLibrary();
  await loadPendingSubmissionCount();
  renderAccessState();
  notify(approve ? 'Конспект опубліковано для всієї школи.' : 'Пропозицію відхилено.');
  await renderSubmissionQueue();
}
async function submitSuggestion(event) {
  event.preventDefault();
  if (!currentUser || !cloudReady) { notify('Увійди, щоб надіслати конспект.'); return; }
  const form = new FormData(event.currentTarget);
  const suggestion = {
    author_id: currentUser.id,
    subject_name: String(form.get('subject_name') || '').trim(),
    topic_name: String(form.get('topic_name') || '').trim(),
    title: String(form.get('title') || '').trim(),
    summary: String(form.get('summary') || '').trim(),
    content: String(form.get('content') || '').trim(),
    image_data: $('#submissionImagePreview').dataset.newImage || ''
  };
  if (suggestion.content.length < 20) { notify('Додай трохи більше змісту — від 20 символів.'); return; }
  const { error } = await cloudClient.from('library_submissions').insert(suggestion);
  if (error) {
    console.error(error);
    notify(error.code === 'P0001' ? 'Забагато пропозицій за короткий час. Спробуй пізніше.' : 'Не вдалося надіслати конспект. Перевір поля й спробуй ще раз.');
    return;
  }
  $('#submissionDialog').close();
  event.currentTarget.reset();
  const imagePreview = $('#submissionImagePreview');
  imagePreview.src = '';
  imagePreview.style.display = 'none';
  delete imagePreview.dataset.newImage;
  notify('Конспект надіслано модератору на перевірку.');
}
function openClassroomImport() {
  if (!isAdmin || !cloudReady) { notify('Імпорт з Classroom доступний лише адміністратору.'); return; }
  classroomCourses = [];
  classroomPreview = [];
  $('#classroomCourseSection').hidden = true;
  $('#classroomCourseList').innerHTML = '';
  $('#classroomPreview').innerHTML = '';
  $('#importClassroomSelection').disabled = true;
  $('#classroomSetupHint').textContent = cloudConfig.classroomClientId
    ? 'Під’єднай свій обліковий запис Google. Сайт запросить доступ лише для читання.'
    : 'Спочатку додай Google OAuth Client ID у supabase-config.js та вкажи адресу сайту в Authorized JavaScript origins.';
  $('#connectClassroom').disabled = !cloudConfig.classroomClientId;
  $('#classroomDialog').showModal();
}
async function connectClassroom() {
  if (!isAdmin || !cloudConfig.classroomClientId) return;
  try {
    await waitForGoogleIdentity();
    const client = google.accounts.oauth2.initTokenClient({
      client_id: cloudConfig.classroomClientId,
      scope: [
        'https://www.googleapis.com/auth/classroom.courses.readonly',
        'https://www.googleapis.com/auth/classroom.topics.readonly',
        'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly'
      ].join(' '),
      callback: async (result) => {
        if (result.error) { notify('Не вдалося під’єднати Google Classroom.'); return; }
        classroomAccessToken = result.access_token;
        $('#classroomSetupHint').textContent = 'Завантажую доступні класи…';
        try {
          classroomCourses = await fetchClassroomCollection('/courses', 'courses', { courseStates: 'ACTIVE' });
          renderClassroomCourses();
        } catch (error) {
          console.error(error);
          classroomAccessToken = '';
          $('#classroomSetupHint').textContent = 'Не вдалося прочитати класи. Перевір доступ Google та налаштування Classroom API.';
        }
      }
    });
    client.requestAccessToken({ prompt: 'consent' });
  } catch (error) {
    console.error(error);
    $('#classroomSetupHint').textContent = 'Не вдалося завантажити вікно Google. Онови сторінку й спробуй ще раз.';
  }
}
function waitForGoogleIdentity() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      if (window.google?.accounts?.oauth2) return resolve();
      if (Date.now() - started > 10000) return reject(new Error('Google Identity Services unavailable'));
      setTimeout(check, 100);
    };
    check();
  });
}
async function fetchClassroomCollection(path, collectionName, params = {}) {
  const items = [];
  let pageToken = '';
  do {
    const url = new URL('https://classroom.googleapis.com/v1' + path);
    url.searchParams.set('pageSize', '100');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { Authorization: 'Bearer ' + classroomAccessToken } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || 'Classroom API ' + response.status);
    items.push(...(payload[collectionName] || []));
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
  return items;
}
function renderClassroomCourses() {
  const section = $('#classroomCourseSection');
  section.hidden = false;
  $('#classroomSetupHint').textContent = classroomCourses.length
    ? 'Обери один або кілька активних класів. Перед записом покажу їхні теми й матеріали.'
    : 'У цьому обліковому записі не знайдено активних класів.';
  $('#classroomCourseCount').textContent = String(classroomCourses.length);
  $('#classroomCourseList').innerHTML = classroomCourses.length
    ? classroomCourses.map((course, index) => '<label class="classroom-course-option"><input type="checkbox" data-classroom-course="' + index + '"><span><strong>' + esc(course.name || 'Клас без назви') + '</strong><small>' + esc(course.section || course.room || 'Google Classroom') + '</small></span></label>').join('')
    : '<p class="auth-copy">Переконайся, що це той самий Google-акаунт, яким ти користуєшся в Classroom.</p>';
}
function classroomCourseName(course) {
  const name = String(course.name || 'Клас Google Classroom').trim();
  const section = String(course.section || '').trim();
  return section ? name + ' · ' + section : name;
}
async function previewClassroomCourses() {
  if (!isAdmin || !classroomAccessToken) return;
  const selected = [...document.querySelectorAll('[data-classroom-course]:checked')]
    .map((checkbox) => classroomCourses[Number(checkbox.dataset.classroomCourse)])
    .filter(Boolean);
  if (!selected.length) { notify('Обери хоча б один клас.'); return; }
  $('#classroomSetupHint').textContent = 'Завантажую теми й матеріали вибраних класів…';
  $('#importClassroomSelection').disabled = true;
  try {
    classroomPreview = await Promise.all(selected.map(async (course) => {
      const [topics, materials] = await Promise.all([
        fetchClassroomCollection('/courses/' + encodeURIComponent(course.id) + '/topics', 'topic'),
        fetchClassroomCollection('/courses/' + encodeURIComponent(course.id) + '/courseWorkMaterials', 'courseWorkMaterial')
      ]);
      const grouped = new Map(topics.map((item) => [item.topicId, { name: item.name, materials: [] }]));
      for (const material of materials) {
        const key = material.topicId || '__without_topic__';
        if (!grouped.has(key)) grouped.set(key, { name: 'Матеріали без теми', materials: [] });
        grouped.get(key).materials.push(material);
      }
      return { course, topics, materials, grouped: [...grouped.values()] };
    }));
    $('#classroomPreview').innerHTML = classroomPreview.map((entry) =>
      '<article class="classroom-preview-card"><h3>' + esc(classroomCourseName(entry.course)) + '</h3><p>' + entry.topics.length + ' тем · ' + entry.materials.length + ' навчальних матеріалів</p><details><summary>Переглянути розподіл</summary>' +
      (entry.grouped.length ? entry.grouped.map((group) => '<div class="classroom-preview-topic"><strong>' + esc(group.name) + '</strong>' +
        (group.materials.length ? '<ul>' + group.materials.map((item) => '<li>' + esc(item.title) + '</li>').join('') + '</ul>' : '<small>Поки без матеріалів</small>') + '</div>').join('') : '<small>У класі поки немає тем і матеріалів.</small>') +
      '</details></article>').join('');
    $('#classroomSetupHint').textContent = 'Перевір розподіл і натисни «Додати до бібліотеки». Усі дії доступні лише для читання в Classroom.';
    $('#importClassroomSelection').disabled = false;
  } catch (error) {
    console.error(error);
    $('#classroomSetupHint').textContent = 'Не вдалося завантажити теми або матеріали. Перепід’єднай Google та спробуй ще раз.';
    classroomPreview = [];
  }
}
async function importClassroomPreview() {
  if (!isAdmin || !cloudReady || !classroomPreview.length) return;
  const previousData = structuredClone(data);
  let addedSubjects = 0, addedTopics = 0, addedMaterials = 0;
  for (const entry of classroomPreview) {
    const courseName = classroomCourseName(entry.course);
    let sub = data.find((item) => item.name.trim().toLocaleLowerCase('uk') === courseName.toLocaleLowerCase('uk'));
    if (!sub) {
      const color = colors[data.length % colors.length];
      sub = { id: uid(), name: courseName, icon: '📚', color: color.color, tint: color.tint, topics: [] };
      data.push(sub);
      addedSubjects++;
    }
    for (const group of entry.grouped) {
      let top = sub.topics.find((item) => item.name.trim().toLocaleLowerCase('uk') === group.name.trim().toLocaleLowerCase('uk'));
      if (!top) {
        top = { id: uid(), name: group.name, description: 'Імпортовано з Google Classroom · ' + courseName, paragraphs: [] };
        sub.topics.push(top);
        addedTopics++;
      }
      for (const material of group.materials) {
        const sourceId = entry.course.id + ':' + material.id;
        if (top.paragraphs.some((item) => item.classroomSourceId === sourceId)) continue;
        const attachmentLinks = (material.materials || []).map((attachment) => {
          if (attachment.link?.url) return attachment.link.url;
          if (attachment.driveFile?.driveFile?.alternateLink) return attachment.driveFile.driveFile.alternateLink;
          if (attachment.youtubeVideo?.alternateLink) return attachment.youtubeVideo.alternateLink;
          if (attachment.form?.formUrl) return attachment.form.formUrl;
          return '';
        }).filter(Boolean);
        const description = String(material.description || '').trim();
        top.paragraphs.push({
          id: uid(),
          name: material.title || 'Матеріал Google Classroom',
          summary: description.slice(0, 180),
          content: [description, ...attachmentLinks.map((url) => 'Матеріал: ' + url)].filter(Boolean).join('\n\n') || 'Матеріал курсу «' + courseName + '».',
          image: '',
          classroomSourceId: sourceId,
          classroomLink: material.alternateLink || ''
        });
        addedMaterials++;
      }
    }
  }
  if (!await saveData()) { data = previousData; return; }
  classroomAccessToken = '';
  classroomPreview = [];
  $('#classroomDialog').close();
  activeScreen = 'library';
  current = { subjectId: null, topicId: null, paragraphId: null };
  render();
  notify('Імпортовано: ' + addedSubjects + ' предметів, ' + addedTopics + ' тем і ' + addedMaterials + ' матеріалів.');
}
function renderSubject(sub) {
  setBreadcrumbs([{ label: 'Спільна бібліотека', action: 'home' }, { label: sub.name }]); const c = counts(sub);
  view.innerHTML = `<div class="page-heading"><div class="page-icon"><span class="large-subject-icon" style="--tint:${esc(sub.tint)}">${esc(sub.icon || '📚')}</span><div><span class="eyebrow">ПРЕДМЕТ</span><h1>${esc(sub.name)}</h1><p>${c.topics} ${plural(c.topics, 'тема', 'теми', 'тем')} · ${c.paragraphs} ${plural(c.paragraphs, 'параграф', 'параграфи', 'параграфів')}</p></div></div>${canManage()?'<div class="heading-actions"><button class="button button-quiet" id="editSubject">Налаштувати</button><button class="button button-primary" id="addTopic">＋ Додати тему</button></div>':''}</div>
    <div class="section-title"><h2>Теми</h2><span>Обери тему, щоб переглянути параграфи</span></div>
    ${sub.topics.length ? `<div class="topic-list">${sub.topics.map((top, i) => `<article class="topic-card" data-open-topic="${esc(top.id)}"><div class="topic-card-row"><span class="topic-index">${String(i+1).padStart(2,'0')}</span><div><h3>${esc(top.name)}</h3><p>${esc(top.description || 'Натисни, щоб переглянути матеріали')}</p></div>${canManage()?`<button class="more-button" data-edit-topic="${esc(top.id)}" aria-label="Налаштувати тему">···</button>`:''}<span class="topic-arrow">›</span></div><div class="topic-card-foot">${top.paragraphs.length} ${plural(top.paragraphs.length, 'параграф', 'параграфи', 'параграфів')}</div></article>`).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">🗂️</div><h3>У цьому предметі ще немає тем</h3><p>${canManage()?'Розділи предмет на теми, щоб матеріали було легше знаходити.':'Адміністратор ще не додав теми до цього предмета.'}</p>${canManage()?'<button class="button button-primary" id="emptyAddTopic">＋ Додати тему</button>':''}</div>`}`;
  $('#editSubject')?.addEventListener('click',()=>openEditor('subject',sub.id));
  $('#addTopic')?.addEventListener('click',()=>openEditor('topic'));
  $('#emptyAddTopic')?.addEventListener('click',()=>openEditor('topic'));
  view.querySelectorAll('[data-open-topic]').forEach(el=>el.addEventListener('click',()=>{current.topicId=el.dataset.openTopic;current.paragraphId=null;render();}));
  view.querySelectorAll('[data-edit-topic]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();openEditor('topic',el.dataset.editTopic);}));
}
function renderTopic(sub, top) {
  setBreadcrumbs([{ label:'Спільна бібліотека',action:'home' },{ label:sub.name,action:'subject' },{ label:top.name }]);
  view.innerHTML=`<button class="back-link" id="backToSubject">← &nbsp;Усі теми: ${esc(sub.name)}</button><div class="page-heading"><div><span class="eyebrow">ТЕМА</span><h1>${esc(top.name)}</h1><p>${esc(top.description || 'Матеріали для повторення')}</p></div>${canManage()?'<div class="heading-actions"><button class="button button-quiet" id="editTopic">Налаштувати</button><button class="button button-primary" id="addParagraph">＋ Додати параграф</button></div>':''}</div>
  ${top.paragraphs.length?`<div class="paragraph-layout"><div class="paragraph-list">${top.paragraphs.map((p,i)=>`<article class="paragraph-row" data-open-paragraph="${esc(p.id)}"><span class="paragraph-no">${readerPrefs.read[p.id]?'✓':String(i+1).padStart(2,'0')}</span><div><h3>${esc(p.name)} ${readerPrefs.favorites.includes(p.id)?'<span class="row-favorite">★</span>':''}</h3><p>${esc(p.summary||'Відкрити матеріал')}</p>${Array.isArray(p.tags)&&p.tags.length?`<div class="tag-list">${p.tags.map((tag)=>`<span class="content-tag">#${esc(tag)}</span>`).join('')}</div>`:''}</div>${p.image?'<span class="row-photo" title="Є зображення">▧</span>':''}<span class="topic-arrow">›</span></article>`).join('')}</div><aside class="study-tip"><strong>💡 Як повторювати</strong><p>Переглядай параграфи по одному та повертайся до них, коли потрібно освіжити знання.</p></aside></div>`:`<div class="empty-state"><div class="empty-icon">✍️</div><h3>${canManage()?'Додай перший параграф':'Параграфів поки немає'}</h3><p>${canManage()?'Запиши пояснення, корисні факти чи додай зображення.':'Адміністратор ще не додав матеріали до цієї теми.'}</p>${canManage()?'<button class="button button-primary" id="emptyAddParagraph">＋ Додати параграф</button>':''}</div>`}`;
  $('#backToSubject').onclick=()=>{current.topicId=null;render();};$('#editTopic')?.addEventListener('click',()=>openEditor('topic',top.id));$('#addParagraph')?.addEventListener('click',()=>openEditor('paragraph'));$('#emptyAddParagraph')?.addEventListener('click',()=>openEditor('paragraph'));
  view.querySelectorAll('[data-open-paragraph]').forEach(el=>el.addEventListener('click',()=>{const p=top.paragraphs.find(item=>item.id===el.dataset.openParagraph);if(p)openParagraph(sub,top,p);}));
}
function renderParagraph(sub,top,p) {
  setBreadcrumbs([{label:'Спільна бібліотека',action:'home'},{label:sub.name,action:'subject'},{label:top.name,action:'topic'}]);
  const tags = Array.isArray(p.tags) ? p.tags : [];
  const history = Array.isArray(p.history) ? p.history : [];
  view.innerHTML=`<button class="back-link" id="backToTopic">← &nbsp;Усі параграфи: ${esc(top.name)}</button><div class="article-actions"><button class="button button-quiet" id="favoriteParagraph" aria-pressed="${readerPrefs.favorites.includes(p.id)}">${readerPrefs.favorites.includes(p.id)?'★ В обраному':'☆ Додати в обране'}</button><button class="button button-quiet" id="markParagraphRead">${readerPrefs.read[p.id]?'✓ Прочитано':'Позначити прочитаним'}</button><button class="button button-quiet" id="printParagraph">Друк / PDF</button><button class="button button-quiet" id="reportParagraph">Повідомити про помилку</button>${canManage()?'<button class="button button-quiet" id="editParagraph">Змінити</button><button class="button button-quiet danger-action" id="deleteParagraph">Видалити</button>':''}</div><article class="article-card" id="printableArticle"><span class="eyebrow">${esc(sub.name.toLocaleUpperCase('uk'))} &nbsp;·&nbsp; ${esc(top.name.toLocaleUpperCase('uk'))}</span><h2>${esc(p.name)}</h2>${p.summary?`<p class="article-summary">${esc(p.summary)}</p>`:''}${tags.length?`<div class="tag-list">${tags.map((tag)=>`<span class="content-tag">#${esc(tag)}</span>`).join('')}</div>`:''}${p.image?`<img class="article-image" src="${esc(p.image)}" alt="Зображення до параграфа: ${esc(p.name)}">`:''}<div class="article-body">${esc(p.content||'Додай сюди свої нотатки.')}</div>${p.updatedAt?`<p class="last-updated">Оновлено: ${new Date(p.updatedAt).toLocaleString('uk-UA')}</p>`:''}${history.length?`<details class="change-history"><summary>Історія змін · ${history.length}</summary>${[...history].reverse().map((version)=>`<article><time>${new Date(version.updatedAt).toLocaleString('uk-UA')}</time><strong>${esc(version.name)}</strong>${version.summary?`<p>${esc(version.summary)}</p>`:''}<div>${esc(version.content||'')}</div></article>`).join('')}</details>`:''}</article><section class="personal-note"><div class="section-title"><h2>Мої нотатки</h2><span>Зберігаються лише в цьому браузері</span></div><textarea id="personalNoteInput" maxlength="5000" placeholder="Запиши своє пояснення або питання до теми…">${esc(readerPrefs.notes[p.id]||'')}</textarea><button class="button button-quiet" id="savePersonalNote">Зберегти нотатку</button></section>`;
  const sourceLink = safeHttpUrl(p.classroomLink);
  if (sourceLink) {
    const link = document.createElement('a');
    link.className = 'classroom-material-link';
    link.href = sourceLink;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Відкрити матеріал у Google Classroom ↗';
    view.querySelector('.article-card h2').after(link);
  }
  $('#backToTopic').onclick=()=>{current.paragraphId=null;render();};
  $('#favoriteParagraph').onclick=()=>{readerPrefs.favorites=readerPrefs.favorites.includes(p.id)?readerPrefs.favorites.filter((id)=>id!==p.id):[p.id,...readerPrefs.favorites];saveReaderPrefs();render();};
  $('#markParagraphRead').onclick=()=>{readerPrefs.read[p.id]=!readerPrefs.read[p.id];saveReaderPrefs();render();};
  $('#savePersonalNote').onclick=()=>{const value=$('#personalNoteInput').value.trim();if(value)readerPrefs.notes[p.id]=value;else delete readerPrefs.notes[p.id];saveReaderPrefs();notify('Особисту нотатку збережено на цьому пристрої.');};
  $('#printParagraph').onclick=()=>window.print();$('#reportParagraph').onclick=()=>openReportDialog(sub,top,p);
  $('#editParagraph')?.addEventListener('click',()=>openEditor('paragraph',p.id));$('#deleteParagraph')?.addEventListener('click',()=>removeItem('paragraph',p.id));
}
function renderSearch(query) {
  const q=query.trim().toLocaleLowerCase('uk'); if(!q){render();return;}
  setBreadcrumbs([{label:'Пошук'}]);const results=[];
  data.forEach(sub=>sub.topics.forEach(top=>top.paragraphs.forEach(p=>{const tags=Array.isArray(p.tags)?p.tags:[];const hay=[sub.name,top.name,top.description,p.name,p.summary,p.content,...tags].join(' ').toLocaleLowerCase('uk');if(hay.includes(q))results.push({sub,top,p,tags});})));
  view.innerHTML=`<div class="welcome-row"><div><span class="eyebrow">ПОШУК У БІБЛІОТЕЦІ</span><h1>Результати</h1><p>${results.length?`За запитом «${esc(query)}» знайдено: ${results.length}`:`За запитом «${esc(query)}» нічого не знайдено`}.</p></div></div>${results.length?`<div class="search-results">${results.map(({sub,top,p,tags})=>`<article class="search-result" data-result="${esc(sub.id)}|${esc(top.id)}|${esc(p.id)}"><small>${esc(sub.name)} &nbsp;›&nbsp; ${esc(top.name)}</small><p><strong>${esc(p.name)}</strong></p><p>${esc(p.summary||p.content.slice(0,120))}</p>${tags.length?`<div class="tag-list">${tags.map((tag)=>`<span class="content-tag">#${esc(tag)}</span>`).join('')}</div>`:''}</article>`).join('')}</div>`:`<div class="empty-state"><div class="empty-icon">🔎</div><h3>Матеріалів не знайдено</h3><p>Спробуй інше слово або перевір назву предмета й теми.</p></div>`}`;
  view.querySelectorAll('[data-result]').forEach(el=>el.addEventListener('click',()=>{const [subjectId,topicId,paragraphId]=el.dataset.result.split('|');const found=findParagraph(paragraphId);$('#searchInput').value='';if(found)openParagraph(found.sub,found.top,found.paragraph);}));
}
function openEditor(kind,id=null) {
  if (!canManage()) { notify('Редагувати спільні матеріали може лише адміністратор.'); return; }
  editContext={kind,id};const dialog=$('#editorDialog'),fields=$('#formFields');const isEdit=Boolean(id);$('#dialogEyebrow').textContent=isEdit?'РЕДАГУВАННЯ':'НОВИЙ ЗАПИС';
  const item=kind==='subject'?subject(id):kind==='topic'?topic(subject(current.subjectId),id):paragraph(topic(subject(current.subjectId),current.topicId),id);
  const labels={subject:['предмет','Предмет'],topic:['тему','Тему'],paragraph:['параграф','Параграф']};$('#dialogTitle').textContent=`${isEdit?'Змінити':'Додати'} ${labels[kind][0]}`;
  if(kind==='subject') fields.innerHTML=`<div class="field"><label for="itemName">Назва предмета</label><input id="itemName" name="name" maxlength="60" required placeholder="Наприклад, Географія" value="${esc(item?.name||'')}"></div><div class="field"><label for="itemIcon">Значок (емодзі)</label><input id="itemIcon" name="icon" maxlength="4" value="${esc(item?.icon||'📚')}" placeholder="📚"><small>Можна залишити 📚 або вибрати будь-яке емодзі.</small></div><div class="color-row"><div class="field"><label for="itemColor">Колір картки</label><input id="itemColor" name="color" type="color" value="${esc(item?.color||colors[data.length%colors.length].color)}"></div><div class="field"><label for="itemTint">Світлий фон</label><input id="itemTint" name="tint" type="color" value="${esc(item?.tint||colors[data.length%colors.length].tint)}"></div></div>`;
  if(kind==='topic') fields.innerHTML=`<div class="field"><label for="itemName">Назва теми</label><input id="itemName" name="name" maxlength="90" required placeholder="Наприклад, Клітина та її будова" value="${esc(item?.name||'')}"></div><div class="field"><label for="itemDescription">Короткий опис</label><textarea id="itemDescription" name="description" maxlength="240" placeholder="Що входить до цієї теми?">${esc(item?.description||'')}</textarea></div>`;
  if(kind==='paragraph') fields.innerHTML=`<div class="field"><label for="itemName">Назва параграфа</label><input id="itemName" name="name" maxlength="110" required placeholder="Наприклад, Клітинна мембрана" value="${esc(item?.name||'')}"></div><div class="field"><label for="itemSummary">Короткий опис</label><input id="itemSummary" name="summary" maxlength="180" placeholder="Про що цей матеріал?" value="${esc(item?.summary||'')}"></div><div class="field"><label for="itemTags">Теги</label><input id="itemTags" name="tags" maxlength="240" value="${esc((item?.tags||[]).join(', '))}" placeholder="контрольна, формули, важливо"><small>Розділяй теги комами — за ними можна шукати матеріали.</small></div><div class="field"><label for="itemContent">Нотатки та корисні матеріали</label><textarea id="itemContent" name="content" maxlength="20000" style="min-height:170px" placeholder="Запиши пояснення, формули, важливі дати чи власні підказки…">${esc(item?.content||'')}</textarea></div><div class="field"><label for="itemImage">Зображення</label><div class="upload-box"><input id="itemImage" name="image" type="file" accept="image/*"><small>Додай схему, мапу чи фото конспекту. Великі зображення буде автоматично зменшено.</small><img id="imagePreview" class="image-preview" alt="Попередній перегляд зображення">${item?.image?'<button type="button" id="removeImage" class="text-button danger-action">Видалити зображення</button>':''}</div></div>`;
  if(kind==='paragraph'&&item?.image){const img=$('#imagePreview');img.src=item.image;img.style.display='block';$('#removeImage').onclick=()=>{img.dataset.removed='true';img.style.display='none';$('#removeImage').remove();};}
  if(isEdit&&kind!=='paragraph')fields.insertAdjacentHTML('beforeend',`<button type="button" class="text-button danger-action" id="deleteRecord">Видалити ${kind==='subject'?'предмет разом з усіма темами та параграфами':'тему разом з усіма параграфами'}</button>`);
  $('#deleteRecord')?.addEventListener('click',()=>{closeEditor();removeItem(kind,id);});
  if(kind==='paragraph') $('#itemImage').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const result=await compressImage(f);const img=$('#imagePreview');img.src=result;img.style.display='block';img.dataset.newImage=result;}catch{notify('Не вдалося відкрити це зображення.');}});
  dialog.showModal();$('#itemName').focus();
}
function compressImage(file) { return new Promise((resolve,reject)=>{if(!file.type.startsWith('image/'))return reject();const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const image=new Image();image.onerror=reject;image.onload=()=>{const scale=Math.min(1,1400/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.78));};image.src=reader.result;};reader.readAsDataURL(file);}); }
function closeEditor(){ $('#editorDialog').close();editContext=null; }
async function saveEditor(event) {
  event.preventDefault();if(!editContext)return;const {kind,id}=editContext;const form=new FormData(event.currentTarget);const name=String(form.get('name')||'').trim();
  const previousData=structuredClone(data);
  if(kind==='subject'){
    if(id){Object.assign(subject(id),{name,icon:String(form.get('icon')||'📚').trim()||'📚',color:form.get('color'),tint:form.get('tint')});}
    else{const c=colors[data.length%colors.length];data.push({id:uid(),name,icon:String(form.get('icon')||'📚').trim()||'📚',color:form.get('color')||c.color,tint:form.get('tint')||c.tint,topics:[]});}
  } else if(kind==='topic'){
    const sub=subject(current.subjectId);if(id)Object.assign(topic(sub,id),{name,description:String(form.get('description')||'').trim()});
    else sub.topics.push({id:uid(),name,description:String(form.get('description')||'').trim(),paragraphs:[]});
  } else {
    const top=topic(subject(current.subjectId),current.topicId);const preview=$('#imagePreview');const existing=id?paragraph(top,id):null;let image=existing?.image||'';if(preview?.dataset.removed==='true')image='';if(preview?.dataset.newImage)image=preview.dataset.newImage;
    const item={name,summary:String(form.get('summary')||'').trim(),content:String(form.get('content')||'').trim(),tags:[...new Set(String(form.get('tags')||'').split(',').map((tag)=>tag.trim()).filter(Boolean))],image};
    if(id){const changed=['name','summary','content','tags','image'].some((key)=>JSON.stringify(existing[key]??(key==='tags'?[]:''))!==JSON.stringify(item[key]));const history=Array.isArray(existing.history)?existing.history:[];if(changed)existing.history=[...history,{name:existing.name,summary:existing.summary||'',content:existing.content||'',tags:existing.tags||[],image:existing.image||'',updatedAt:existing.updatedAt||new Date().toISOString()}].slice(-8);Object.assign(existing,item,{updatedAt:changed?new Date().toISOString():(existing.updatedAt||'')});}
    else top.paragraphs.push({id:uid(),...item,updatedAt:new Date().toISOString(),history:[]});
  }
  if(!await saveData()){data=previousData;return;}
  closeEditor();render();notify(`${labelsWord(kind)} ${id?'оновлено':'додано'}`);
}
function labelsWord(kind){return {subject:'Предмет',topic:'Тему',paragraph:'Параграф'}[kind];}
async function removeItem(kind,id){if(!canManage())return;const words={subject:'предмет разом з усіма його темами й параграфами',topic:'тему разом з усіма її параграфами',paragraph:'параграф'};if(!confirm(`Видалити ${words[kind]}? Цю дію не можна скасувати.`))return;const previousData=structuredClone(data);if(kind==='subject'){data=data.filter(x=>x.id!==id);current={subjectId:null,topicId:null,paragraphId:null};}if(kind==='topic'){const sub=subject(current.subjectId);sub.topics=sub.topics.filter(x=>x.id!==id);current.topicId=null;}if(kind==='paragraph'){const top=topic(subject(current.subjectId),current.topicId);top.paragraphs=top.paragraphs.filter(x=>x.id!==id);current.paragraphId=null;}if(!await saveData())data=previousData;else notify('Матеріал видалено');render();}
function backup(){const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),subjects:data},null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='tetrad-backup.json';link.click();URL.revokeObjectURL(link.href);}
async function importBackup(file){if(!canManage())return;const previousData=structuredClone(data);try{const parsed=JSON.parse(await file.text());const candidate=Array.isArray(parsed)?parsed:parsed.subjects;if(!Array.isArray(candidate)||candidate.some(s=>typeof s.name!=='string'||!Array.isArray(s.topics)))throw new Error();if(!confirm(`Замінити поточну бібліотеку? Буде імпортовано предметів: ${candidate.length}.`))return;data=candidate;current={subjectId:null,topicId:null,paragraphId:null};if(!await saveData())data=previousData;else notify('Спільну бібліотеку оновлено');render();}catch{data=previousData;notify('Цей файл не схожий на копію бібліотеки.');}}
$('#addSubject').onclick=()=>openEditor('subject');$('#editorForm').addEventListener('submit',saveEditor);$('#closeDialog').onclick=closeEditor;$('#cancelDialog').onclick=closeEditor;$('#editorDialog').addEventListener('click',e=>{if(e.target===$('#editorDialog'))closeEditor();});$('#homeLink').onclick=e=>{e.preventDefault();activeScreen='library';current={subjectId:null,topicId:null,paragraphId:null};$('#searchInput').value='';render();};$('#backupButton').onclick=backup;$('#importButton').onclick=()=>{if(canManage())$('#importFile').click();};$('#importFile').addEventListener('change',e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value='';});
$('#accountButton').addEventListener('click',handleAccountButton);$('#submitNotesButton').addEventListener('click',openSubmissionFlow);$('#authForm').addEventListener('submit',requestAdminLink);$('#googleSignInButton').addEventListener('click',signInWithGoogle);$('#closeAuthDialog').onclick=()=>$('#authDialog').close();$('#cancelAuthDialog').onclick=()=>$('#authDialog').close();$('#authDialog').addEventListener('click',e=>{if(e.target===$('#authDialog'))$('#authDialog').close();});
$('#submissionForm').addEventListener('submit',submitSuggestion);$('#submissionImage').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const image=await compressImage(file);if(image.length>500000){e.target.value='';notify('Зображення завелике. Спробуй менше або простіше фото.');return;}const preview=$('#submissionImagePreview');preview.src=image;preview.style.display='block';preview.dataset.newImage=image;}catch{notify('Не вдалося відкрити це зображення.');}});$('#closeSubmissionDialog').onclick=()=>$('#submissionDialog').close();$('#cancelSubmissionDialog').onclick=()=>$('#submissionDialog').close();$('#submissionDialog').addEventListener('click',e=>{if(e.target===$('#submissionDialog'))$('#submissionDialog').close();});
$('#classroomImportButton').addEventListener('click',openClassroomImport);$('#connectClassroom').addEventListener('click',connectClassroom);$('#previewClassroomSelection').addEventListener('click',previewClassroomCourses);$('#importClassroomSelection').addEventListener('click',importClassroomPreview);$('#closeClassroomDialog').onclick=()=>$('#classroomDialog').close();$('#cancelClassroomDialog').onclick=()=>$('#classroomDialog').close();$('#classroomDialog').addEventListener('click',e=>{if(e.target===$('#classroomDialog'))$('#classroomDialog').close();});
$('#reportsButton').addEventListener('click',()=>{activeScreen='reports';current={subjectId:null,topicId:null,paragraphId:null};render();});$('#reportForm').addEventListener('submit',submitLibraryReport);$('#closeReportDialog').onclick=()=>$('#reportDialog').close();$('#cancelReportDialog').onclick=()=>$('#reportDialog').close();$('#reportDialog').addEventListener('click',e=>{if(e.target===$('#reportDialog'))$('#reportDialog').close();});
$('#csvImportButton').addEventListener('click',startCsvImport);$('#csvImportFileVisible').addEventListener('change',e=>previewCsvFile(e.target.files[0]));$('#downloadCsvTemplate').addEventListener('click',downloadCsvTemplate);$('#confirmCsvImport').addEventListener('click',importCsvRows);$('#closeCsvImportDialog').onclick=()=>$('#csvImportDialog').close();$('#cancelCsvImport').onclick=()=>$('#csvImportDialog').close();$('#csvImportDialog').addEventListener('click',e=>{if(e.target===$('#csvImportDialog'))$('#csvImportDialog').close();});
$('#searchInput').addEventListener('input',e=>{activeScreen='library';renderSearch(e.target.value);});document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#searchInput').focus();}if(e.key==='Escape'&&$('#editorDialog').open)closeEditor();});
initializeApp();
