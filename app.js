const STORAGE_KEY = 'tetrad-library-v1';
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
let current = { subjectId: null, topicId: null, paragraphId: null };
let editContext = null;
let toastTimer;
const $ = (selector) => document.querySelector(selector);
const view = $('#view');

function loadData() {
  try { const saved = localStorage.getItem(STORAGE_KEY); return saved ? JSON.parse(saved) : structuredClone(starter); }
  catch { return structuredClone(starter); }
}
function saveData() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; } catch { notify('Не вдалося зберегти дані. Спробуй зменшити зображення.'); return false; } }
function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function subject(id) { return data.find((item) => item.id === id); }
function topic(sub, id) { return sub?.topics.find((item) => item.id === id); }
function paragraph(top, id) { return top?.paragraphs.find((item) => item.id === id); }
function esc(value = '') { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function notify(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600); }
function counts(sub) { return { topics: sub.topics.length, paragraphs: sub.topics.reduce((sum, item) => sum + item.paragraphs.length, 0) }; }
function renderNav() {
  $('#subjectNav').innerHTML = data.map((sub) => {
    const count = counts(sub).paragraphs;
    return `<button class="subject-link ${current.subjectId === sub.id ? 'active' : ''}" data-subject="${esc(sub.id)}"><span class="subject-icon">${esc(sub.icon || '📚')}</span><span>${esc(sub.name)}</span><span class="subject-count">${count}</span></button>`;
  }).join('');
  $('#subjectNav').querySelectorAll('[data-subject]').forEach((el) => el.addEventListener('click', () => { current = { subjectId: el.dataset.subject, topicId: null, paragraphId: null }; render(); }));
}
function setBreadcrumbs(items) {
  $('#breadcrumbs').innerHTML = items.map((item, index) => `${index ? '<span class="crumb-sep">/</span>' : ''}${item.action ? `<button data-crumb="${item.action}">${esc(item.label)}</button>` : `<strong>${esc(item.label)}</strong>`}`).join('');
  $('#breadcrumbs').querySelectorAll('[data-crumb]').forEach((el) => el.addEventListener('click', () => { if (el.dataset.crumb === 'home') current = { subjectId: null, topicId: null, paragraphId: null }; if (el.dataset.crumb === 'subject') current.topicId = current.paragraphId = null; render(); }));
}
function render() { renderNav(); if (!current.subjectId) return renderHome(); const sub = subject(current.subjectId); if (!sub) { current = { subjectId: null, topicId: null, paragraphId: null }; return render(); } if (!current.topicId) return renderSubject(sub); const top = topic(sub, current.topicId); if (!top) { current.topicId = null; return render(); } if (!current.paragraphId) return renderTopic(sub, top); const para = paragraph(top, current.paragraphId); if (!para) { current.paragraphId = null; return render(); } renderParagraph(sub, top, para); }
function renderHome() {
  setBreadcrumbs([{ label: 'Моя бібліотека' }]);
  const totalTopics = data.reduce((sum, sub) => sum + sub.topics.length, 0);
  const totalParas = data.reduce((sum, sub) => sum + counts(sub).paragraphs, 0);
  view.innerHTML = `<div class="welcome-row"><div><span class="eyebrow">ТВОЄ МІСЦЕ ДЛЯ ЗНАНЬ</span><h1>Усе важливе — поруч</h1><p>Збирай матеріали за предметами та повертайся до них будь-коли.</p></div><button class="button button-primary" id="homeAddSubject">＋ &nbsp;Додати предмет</button></div>
    <div class="overview-grid"><div class="stat-card"><span class="stat-icon">📚</span><div><div class="stat-number">${data.length}</div><div class="stat-label">предметів</div></div></div><div class="stat-card"><span class="stat-icon">🗂️</span><div><div class="stat-number">${totalTopics}</div><div class="stat-label">тем</div></div></div><div class="stat-card"><span class="stat-icon">✍️</span><div><div class="stat-number">${totalParas}</div><div class="stat-label">параграфів</div></div></div></div>
    <div class="section-title"><h2>Предмети</h2><span>${data.length ? 'Обери, що повторити' : 'Почни з першого предмета'}</span></div>
    ${data.length ? `<div class="subject-grid">${data.map((sub) => { const c = counts(sub); return `<article class="subject-card" data-open-subject="${esc(sub.id)}" style="--card-color:${esc(sub.color)};--card-tint:${esc(sub.tint)}"><div class="card-band"></div><div class="subject-card-body"><div class="card-top"><span class="card-emoji">${esc(sub.icon || '📚')}</span><button class="more-button" data-edit-subject="${esc(sub.id)}" aria-label="Налаштувати предмет ${esc(sub.name)}">···</button></div><h3>${esc(sub.name)}</h3><div class="card-meta">${c.topics} ${plural(c.topics, 'тема', 'теми', 'тем')}</div><div class="subject-card-foot"><span>${c.paragraphs} ${plural(c.paragraphs, 'параграф', 'параграфи', 'параграфів')}</span><b>Відкрити →</b></div></div></article>`; }).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">📖</div><h3>Додай перший предмет</h3><p>Наприклад, біологію чи історію. Потім створи теми та додай параграфи для повторення.</p><button class="button button-primary" id="emptyAddSubject">＋ Додати предмет</button></div>`}`;
  $('#homeAddSubject')?.addEventListener('click', () => openEditor('subject'));
  $('#emptyAddSubject')?.addEventListener('click', () => openEditor('subject'));
  view.querySelectorAll('[data-open-subject]').forEach((el) => el.addEventListener('click', () => { current.subjectId = el.dataset.openSubject; render(); }));
  view.querySelectorAll('[data-edit-subject]').forEach((el) => el.addEventListener('click', (event) => { event.stopPropagation(); openEditor('subject', el.dataset.editSubject); }));
}
function plural(n, one, few, many) { const n10=n%10,n100=n%100; return n10===1&&n100!==11?one:n10>=2&&n10<=4&&(n100<12||n100>14)?few:many; }
function renderSubject(sub) {
  setBreadcrumbs([{ label: 'Моя бібліотека', action: 'home' }, { label: sub.name }]); const c = counts(sub);
  view.innerHTML = `<div class="page-heading"><div class="page-icon"><span class="large-subject-icon" style="--tint:${esc(sub.tint)}">${esc(sub.icon || '📚')}</span><div><span class="eyebrow">ПРЕДМЕТ</span><h1>${esc(sub.name)}</h1><p>${c.topics} ${plural(c.topics, 'тема', 'теми', 'тем')} · ${c.paragraphs} ${plural(c.paragraphs, 'параграф', 'параграфи', 'параграфів')}</p></div></div><div class="heading-actions"><button class="button button-quiet" id="editSubject">Налаштувати</button><button class="button button-primary" id="addTopic">＋ Додати тему</button></div></div>
    <div class="section-title"><h2>Теми</h2><span>Обери тему, щоб переглянути параграфи</span></div>
    ${sub.topics.length ? `<div class="topic-list">${sub.topics.map((top, i) => `<article class="topic-card" data-open-topic="${esc(top.id)}"><div class="topic-card-row"><span class="topic-index">${String(i+1).padStart(2,'0')}</span><div><h3>${esc(top.name)}</h3><p>${esc(top.description || 'Натисни, щоб переглянути матеріали')}</p></div><button class="more-button" data-edit-topic="${esc(top.id)}" aria-label="Налаштувати тему">···</button><span class="topic-arrow">›</span></div><div class="topic-card-foot">${top.paragraphs.length} ${plural(top.paragraphs.length, 'параграф', 'параграфи', 'параграфів')}</div></article>`).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">🗂️</div><h3>У цьому предметі ще немає тем</h3><p>Розділи предмет на теми, щоб матеріали було легше знаходити.</p><button class="button button-primary" id="emptyAddTopic">＋ Додати тему</button></div>`}`;
  view.querySelectorAll('[data-open-topic]').forEach(el=>el.addEventListener('click',()=>{current.topicId=el.dataset.openTopic;render();}));
  view.querySelectorAll('[data-edit-topic]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();openEditor('topic',el.dataset.editTopic);}));
}
function renderTopic(sub, top) {
  setBreadcrumbs([{ label:'Моя бібліотека',action:'home' },{ label:sub.name,action:'subject' },{ label:top.name }]);
  view.innerHTML=`<button class="back-link" id="backToSubject">← &nbsp;Усі теми: ${esc(sub.name)}</button><div class="page-heading"><div><span class="eyebrow">ТЕМА</span><h1>${esc(top.name)}</h1><p>${esc(top.description || 'Матеріали для повторення')}</p></div><div class="heading-actions"><button class="button button-quiet" id="editTopic">Налаштувати</button><button class="button button-primary" id="addParagraph">＋ Додати параграф</button></div></div>
  ${top.paragraphs.length?`<div class="paragraph-layout"><div class="paragraph-list">${top.paragraphs.map((p,i)=>`<article class="paragraph-row" data-open-paragraph="${esc(p.id)}"><span class="paragraph-no">${String(i+1).padStart(2,'0')}</span><div><h3>${esc(p.name)}</h3><p>${esc(p.summary||'Відкрити матеріал')}</p></div>${p.image?'<span class="row-photo" title="Є зображення">▧</span>':''}<span class="topic-arrow">›</span></article>`).join('')}</div><aside class="study-tip"><strong>💡 Як повторювати</strong><p>Переглядай параграфи по одному та повертайся до них, коли потрібно освіжити знання.</p></aside></div>`:`<div class="empty-state"><div class="empty-icon">✍️</div><h3>Додай перший параграф</h3><p>Запиши пояснення, корисні факти чи додай зображення.</p><button class="button button-primary" id="emptyAddParagraph">＋ Додати параграф</button></div>`}`;
  $('#backToSubject').onclick=()=>{current.topicId=null;render();};$('#editTopic').onclick=()=>openEditor('topic',top.id);$('#addParagraph').onclick=()=>openEditor('paragraph');$('#emptyAddParagraph')?.addEventListener('click',()=>openEditor('paragraph'));
  view.querySelectorAll('[data-open-paragraph]').forEach(el=>el.addEventListener('click',()=>{current.paragraphId=el.dataset.openParagraph;render();}));
}
function renderParagraph(sub,top,p) {
  setBreadcrumbs([{label:'Моя бібліотека',action:'home'},{label:sub.name,action:'subject'},{label:top.name,action:'subject'}]);
  view.innerHTML=`<button class="back-link" id="backToTopic">← &nbsp;Усі параграфи: ${esc(top.name)}</button><div class="article-actions"><button class="button button-quiet" id="editParagraph">Змінити</button><button class="button button-quiet danger-action" id="deleteParagraph">Видалити</button></div><article class="article-card"><span class="eyebrow">${esc(sub.name.toLocaleUpperCase('uk'))} &nbsp;·&nbsp; ${esc(top.name.toLocaleUpperCase('uk'))}</span><h2>${esc(p.name)}</h2>${p.summary?`<p class="article-summary">${esc(p.summary)}</p>`:''}${p.image?`<img class="article-image" src="${p.image}" alt="Зображення до параграфа: ${esc(p.name)}">`:''}<div class="article-body">${esc(p.content||'Додай сюди свої нотатки.')}</div></article>`;
  $('#backToTopic').onclick=()=>{current.paragraphId=null;render();};$('#editParagraph').onclick=()=>openEditor('paragraph',p.id);$('#deleteParagraph').onclick=()=>removeItem('paragraph',p.id);
}
function renderSearch(query) {
  const q=query.trim().toLocaleLowerCase('uk'); if(!q){render();return;}
  setBreadcrumbs([{label:'Пошук'}]);const results=[];
  data.forEach(sub=>sub.topics.forEach(top=>top.paragraphs.forEach(p=>{const hay=[sub.name,top.name,p.name,p.summary,p.content].join(' ').toLocaleLowerCase('uk');if(hay.includes(q))results.push({sub,top,p});})));
  view.innerHTML=`<div class="welcome-row"><div><span class="eyebrow">ПОШУК У БІБЛІОТЕЦІ</span><h1>Результати</h1><p>${results.length?`За запитом «${esc(query)}» знайдено: ${results.length}`:`За запитом «${esc(query)}» нічого не знайдено`}.</p></div></div>${results.length?`<div class="search-results">${results.map(({sub,top,p})=>`<article class="search-result" data-result="${esc(sub.id)}|${esc(top.id)}|${esc(p.id)}"><small>${esc(sub.name)} &nbsp;›&nbsp; ${esc(top.name)}</small><p><strong>${esc(p.name)}</strong></p><p>${esc(p.summary||p.content.slice(0,120))}</p></article>`).join('')}</div>`:`<div class="empty-state"><div class="empty-icon">🔎</div><h3>Матеріалів не знайдено</h3><p>Спробуй інше слово або перевір назву предмета й теми.</p></div>`}`;
  view.querySelectorAll('[data-result]').forEach(el=>el.addEventListener('click',()=>{const [subjectId,topicId,paragraphId]=el.dataset.result.split('|');current={subjectId,topicId,paragraphId};$('#searchInput').value='';render();}));
}
function openEditor(kind,id=null) {
  editContext={kind,id};const dialog=$('#editorDialog'),fields=$('#formFields');const isEdit=Boolean(id);$('#dialogEyebrow').textContent=isEdit?'РЕДАГУВАННЯ':'НОВИЙ ЗАПИС';
  const item=kind==='subject'?subject(id):kind==='topic'?topic(subject(current.subjectId),id):paragraph(topic(subject(current.subjectId),current.topicId),id);
  const labels={subject:['предмет','Предмет'],topic:['тему','Тему'],paragraph:['параграф','Параграф']};$('#dialogTitle').textContent=`${isEdit?'Змінити':'Додати'} ${labels[kind][0]}`;
  if(kind==='subject') fields.innerHTML=`<div class="field"><label for="itemName">Назва предмета</label><input id="itemName" name="name" maxlength="60" required placeholder="Наприклад, Географія" value="${esc(item?.name||'')}"></div><div class="field"><label for="itemIcon">Значок (емодзі)</label><input id="itemIcon" name="icon" maxlength="4" value="${esc(item?.icon||'📚')}" placeholder="📚"><small>Можна залишити 📚 або вибрати будь-яке емодзі.</small></div><div class="color-row"><div class="field"><label for="itemColor">Колір картки</label><input id="itemColor" name="color" type="color" value="${esc(item?.color||colors[data.length%colors.length].color)}"></div><div class="field"><label for="itemTint">Світлий фон</label><input id="itemTint" name="tint" type="color" value="${esc(item?.tint||colors[data.length%colors.length].tint)}"></div></div>`;
  if(kind==='topic') fields.innerHTML=`<div class="field"><label for="itemName">Назва теми</label><input id="itemName" name="name" maxlength="90" required placeholder="Наприклад, Клітина та її будова" value="${esc(item?.name||'')}"></div><div class="field"><label for="itemDescription">Короткий опис</label><textarea id="itemDescription" name="description" maxlength="240" placeholder="Що входить до цієї теми?">${esc(item?.description||'')}</textarea></div>`;
  if(kind==='paragraph') fields.innerHTML=`<div class="field"><label for="itemName">Назва параграфа</label><input id="itemName" name="name" maxlength="110" required placeholder="Наприклад, Клітинна мембрана" value="${esc(item?.name||'')}"></div><div class="field"><label for="itemSummary">Короткий опис</label><input id="itemSummary" name="summary" maxlength="180" placeholder="Про що цей матеріал?" value="${esc(item?.summary||'')}"></div><div class="field"><label for="itemContent">Нотатки та корисні матеріали</label><textarea id="itemContent" name="content" maxlength="20000" style="min-height:170px" placeholder="Запиши пояснення, формули, важливі дати чи власні підказки…">${esc(item?.content||'')}</textarea></div><div class="field"><label for="itemImage">Зображення</label><div class="upload-box"><input id="itemImage" type="file" accept="image/*"><small>Додай схему, мапу чи фото конспекту. Великі зображення буде автоматично зменшено.</small><img id="imagePreview" class="image-preview" alt="Попередній перегляд зображення">${item?.image?'<button type="button" id="removeImage" class="text-button danger-action">Видалити зображення</button>':''}</div></div>`;
  if(kind==='paragraph'&&item?.image){const img=$('#imagePreview');img.src=item.image;img.style.display='block';$('#removeImage').onclick=()=>{img.dataset.removed='true';img.style.display='none';$('#removeImage').remove();};}
  if(isEdit&&kind!=='paragraph')fields.insertAdjacentHTML('beforeend',`<button type="button" class="text-button danger-action" id="deleteRecord">Видалити ${kind==='subject'?'предмет разом з усіма темами та параграфами':'тему разом з усіма параграфами'}</button>`);
  $('#deleteRecord')?.addEventListener('click',()=>{closeEditor();removeItem(kind,id);});
  if(kind==='paragraph') $('#itemImage').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const result=await compressImage(f);const img=$('#imagePreview');img.src=result;img.style.display='block';img.dataset.newImage=result;}catch{notify('Не вдалося відкрити це зображення.');}});
  dialog.showModal();$('#itemName').focus();
}
function compressImage(file) { return new Promise((resolve,reject)=>{if(!file.type.startsWith('image/'))return reject();const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const image=new Image();image.onerror=reject;image.onload=()=>{const scale=Math.min(1,1400/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.78));};image.src=reader.result;};reader.readAsDataURL(file);}); }
function closeEditor(){ $('#editorDialog').close();editContext=null; }
function saveEditor(event) {
  event.preventDefault();if(!editContext)return;const {kind,id}=editContext;const form=new FormData(event.currentTarget);const name=String(form.get('name')||'').trim();
  if(kind==='subject'){
    if(id){Object.assign(subject(id),{name,icon:String(form.get('icon')||'📚').trim()||'📚',color:form.get('color'),tint:form.get('tint')});}
    else{const c=colors[data.length%colors.length];data.push({id:uid(),name,icon:String(form.get('icon')||'📚').trim()||'📚',color:form.get('color')||c.color,tint:form.get('tint')||c.tint,topics:[]});}
  } else if(kind==='topic'){
    const sub=subject(current.subjectId);if(id)Object.assign(topic(sub,id),{name,description:String(form.get('description')||'').trim()});
    else sub.topics.push({id:uid(),name,description:String(form.get('description')||'').trim(),paragraphs:[]});
  } else {
    const top=topic(subject(current.subjectId),current.topicId);const preview=$('#imagePreview');let image=id?paragraph(top,id).image:'';if(preview?.dataset.removed==='true')image='';if(preview?.dataset.newImage)image=preview.dataset.newImage;
    const item={name,summary:String(form.get('summary')||'').trim(),content:String(form.get('content')||'').trim(),image};if(id)Object.assign(paragraph(top,id),item);else top.paragraphs.push({id:uid(),...item});
  }
  saveData();closeEditor();render();notify(`${labelsWord(kind)} ${id?'оновлено':'додано'}`);
}
function labelsWord(kind){return {subject:'Предмет',topic:'Тему',paragraph:'Параграф'}[kind];}
function removeItem(kind,id){const words={subject:'предмет разом з усіма його темами й параграфами',topic:'тему разом з усіма її параграфами',paragraph:'параграф'};if(!confirm(`Видалити ${words[kind]}? Цю дію не можна скасувати.`))return;if(kind==='subject'){data=data.filter(x=>x.id!==id);current={subjectId:null,topicId:null,paragraphId:null};}if(kind==='topic'){const sub=subject(current.subjectId);sub.topics=sub.topics.filter(x=>x.id!==id);current.topicId=null;}if(kind==='paragraph'){const top=topic(subject(current.subjectId),current.topicId);top.paragraphs=top.paragraphs.filter(x=>x.id!==id);current.paragraphId=null;}saveData();render();notify('Матеріал видалено');}
function backup(){const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),subjects:data},null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='tetrad-backup.json';link.click();URL.revokeObjectURL(link.href);}
async function importBackup(file){try{const parsed=JSON.parse(await file.text());const candidate=Array.isArray(parsed)?parsed:parsed.subjects;if(!Array.isArray(candidate)||candidate.some(s=>typeof s.name!=='string'||!Array.isArray(s.topics)))throw new Error();if(!confirm(`Замінити поточну бібліотеку? Буде імпортовано предметів: ${candidate.length}.`))return;data=candidate;current={subjectId:null,topicId:null,paragraphId:null};saveData();render();notify('Резервну копію завантажено');}catch{notify('Цей файл не схожий на копію бібліотеки.');}}
$('#addSubject').onclick=()=>openEditor('subject');$('#editorForm').addEventListener('submit',saveEditor);$('#closeDialog').onclick=closeEditor;$('#cancelDialog').onclick=closeEditor;$('#editorDialog').addEventListener('click',e=>{if(e.target===$('#editorDialog'))closeEditor();});$('#homeLink').onclick=e=>{e.preventDefault();current={subjectId:null,topicId:null,paragraphId:null};$('#searchInput').value='';render();};$('#backupButton').onclick=backup;$('#importButton').onclick=()=>$('#importFile').click();$('#importFile').addEventListener('change',e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value='';});
$('#searchInput').addEventListener('input',e=>renderSearch(e.target.value));document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#searchInput').focus();}if(e.key==='Escape'&&$('#editorDialog').open)closeEditor();});
render();
