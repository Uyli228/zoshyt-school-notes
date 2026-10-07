// Сайт «Зошит»: підставляє готові матеріали з Gemini у вікно «Імпорт матеріалів».
(() => {
  if (!document.getElementById('csvImportDialog')) return;     // це не сайт «Зошит»
  let waitingForImport = false;

  async function openImport() {
    const { ready = [] } = await Z.get(['ready']);
    if (!ready.length) { Z.badge(''); return; }
    const button = document.getElementById('csvImportButton');
    if (!button || button.hidden) { Z.badge(`📒 Готово ${ready.length} матеріалів з Classroom. Увійди як адміністратор, і я відкрию імпорт.`, openImport); return; }
    button.click();
    await Z.wait(300);
    const area = document.getElementById('csvImportPaste');
    area.value = JSON.stringify({ materials: ready });
    area.dispatchEvent(new Event('input', { bubbles: true }));
    waitingForImport = true;
    Z.badge('');
  }

  // Після успішного імпорту прибираємо матеріали з розширення, щоб не додати їх двічі.
  new MutationObserver(async () => {
    const toast = document.getElementById('toast');
    if (!waitingForImport || !toast || !/^Додано \d+/.test(toast.textContent)) return;
    waitingForImport = false;
    const { ready = [], imported = 0 } = await Z.get(['ready', 'imported']);
    await Z.set({ ready: [], imported: imported + ready.length, lastImport: Date.now() });
  }).observe(document.getElementById('toast'), { childList: true, characterData: true, subtree: true });

  async function check() {
    const { ready = [] } = await Z.get(['ready']);
    if (!ready.length) { Z.badge(''); return; }
    if (location.hash.includes('zoshit-import')) {
      history.replaceState(null, '', location.pathname + location.search);
      for (let t = 0; t < 30; t++) { const b = document.getElementById('csvImportButton'); if (b && !b.hidden) break; await Z.wait(500); }
      openImport();
    } else Z.badge(`📒 З Classroom готово ${ready.length} матеріалів — натисни, щоб імпортувати`, openImport);
  }
  chrome.storage.onChanged.addListener((changes) => { if (changes.ready) check(); });
  setTimeout(check, 1200);
})();
