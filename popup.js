(
  async function () {
    const statusEl = document.getElementById('status');
    const setStatus = (txt) => (statusEl.textContent = txt);

    async function getActiveTab() {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        setStatus('Aktif sekme bulunamadı.');
        return null;
      }
      return tab;
    }

    // ── DOLDUR butonu ──
    document.getElementById('fill').addEventListener('click', async () => {
      const mode = document.querySelector('input[name="mode"]:checked').value;
      setStatus('Dolduruluyor...');
      try {
        const tab = await getActiveTab();
        if (!tab) return;

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          func: (selectedMode) => {
            const normalizeText = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

            let radioMarkedCount = 0;

            // ── 1) Standart <input type="radio"> ──
            const radiosAll = Array.from(document.querySelectorAll('input[type="radio"]'));

            const groups = new Map();
            for (const r of radiosAll) {
              const key = r.name ? `name:${r.name}` : r.closest('label') ? `label:${normalizeText(r.closest('label'))}` : `id:${r.id || Math.random()}`;
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key).push(r);
            }

            for (const list of groups.values()) {
              let candidate = null;

              if (selectedMode === 'max') {
                candidate = list.find((r) => String(r.value).trim() === '5');
                if (!candidate) {
                  const numeric = list
                    .map((r) => ({ r, v: parseFloat(String(r.value).replace(',', '.')) }))
                    .filter((o) => !Number.isNaN(o.v));
                  if (numeric.length) {
                    candidate = numeric.reduce((a, b) => (a.v >= b.v ? a : b)).r;
                  }
                }
                if (!candidate) candidate = list[list.length - 1];
              } else if (selectedMode === 'min') {
                candidate = list.find((r) => String(r.value).trim() === '1');
                if (!candidate) {
                  const numeric = list
                    .map((r) => ({ r, v: parseFloat(String(r.value).replace(',', '.')) }))
                    .filter((o) => !Number.isNaN(o.v));
                  if (numeric.length) {
                    candidate = numeric.reduce((a, b) => (a.v <= b.v ? a : b)).r;
                  }
                }
                if (!candidate) candidate = list[0];
              } else {
                candidate = list[Math.floor(Math.random() * list.length)];
              }

              if (candidate) {
                const label = candidate.id ? document.querySelector(`label[for="${candidate.id}"]`) : candidate.closest('label');
                (label || candidate).click();
                try {
                  candidate.dispatchEvent(new Event('input', { bubbles: true }));
                  candidate.dispatchEvent(new Event('change', { bubbles: true }));
                } catch {}
                radioMarkedCount++;
              }
            }

            // ── 2) Google Forms: div[role="radio"] ──
            const gfGroups = new Map();
            const gfRadios = Array.from(document.querySelectorAll('div[role="radio"], div[role="option"]'));

            for (const r of gfRadios) {
              const group = r.closest('div[role="radiogroup"], div[role="listbox"], div[role="list"]');
              const key = group ? `gf:${group.getAttribute('aria-labelledby') || group.getAttribute('data-params') || Array.from(document.querySelectorAll('div[role="radiogroup"], div[role="listbox"], div[role="list"]')).indexOf(group)}` : `gf:solo:${Math.random()}`;
              if (!gfGroups.has(key)) gfGroups.set(key, []);
              gfGroups.get(key).push(r);
            }

            for (const list of gfGroups.values()) {
              let candidate = null;

              const getVal = (el) => {
                const dv = el.getAttribute('data-value') || '';
                const al = el.getAttribute('aria-label') || '';
                const txt = normalizeText(el);
                const raw = dv || al || txt;
                const num = parseFloat(raw.replace(',', '.'));
                return Number.isNaN(num) ? null : num;
              };

              const withNums = list.map((r) => ({ r, v: getVal(r) }));
              const numeric = withNums.filter((o) => o.v !== null);

              if (selectedMode === 'max') {
                if (numeric.length) {
                  candidate = numeric.reduce((a, b) => (a.v >= b.v ? a : b)).r;
                } else {
                  candidate = list[list.length - 1];
                }
              } else if (selectedMode === 'min') {
                if (numeric.length) {
                  candidate = numeric.reduce((a, b) => (a.v <= b.v ? a : b)).r;
                } else {
                  candidate = list[0];
                }
              } else {
                candidate = list[Math.floor(Math.random() * list.length)];
              }

              if (candidate && candidate.getAttribute('aria-checked') !== 'true') {
                candidate.click();
                try {
                  candidate.dispatchEvent(new Event('input', { bubbles: true }));
                  candidate.dispatchEvent(new Event('change', { bubbles: true }));
                } catch {}
                radioMarkedCount++;
              }
            }

            // ── 3) Google Forms: Checkbox gruplari ──
            const gfCheckboxes = Array.from(document.querySelectorAll('div[role="checkbox"]'));
            for (const cb of gfCheckboxes) {
              if (cb.getAttribute('aria-checked') !== 'true') {
                if (selectedMode === 'random' && Math.random() < 0.5) continue;
                cb.click();
                radioMarkedCount++;
              }
            }

            return radioMarkedCount;
          },
          args: [mode],
        });

        const total = results.map((r) => r?.result || 0).reduce((a, b) => a + b, 0);
        setStatus(`İşaretlenen: ${total}`);
      } catch (err) {
        console.error(err);
        setStatus('Hata: ' + err.message);
      }
    });

    // ── KAYDET butonu ──
    document.getElementById('save').addEventListener('click', async () => {
      setStatus('Kaydediliyor...');
      try {
        const tab = await getActiveTab();
        if (!tab) return;

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          func: () => {
            const normalizeText = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
            const toLower = (s) => s?.toLocaleLowerCase('tr') || '';

            const keywords = ['kaydet', 'gönder', 'submit', 'bitir', 'tamam', 'kaydet ve devam', 'kayıt', 'save', 'finish', 'gonder', 'send'];
            const candidates = Array.from(
              document.querySelectorAll(
                'button, input[type="button"], input[type="submit"], [role="button"], a.button, a[onclick], div[role="button"]'
              )
            );

            const findSave = () => {
              const typeSubmit = Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"]'));
              if (typeSubmit.length) return typeSubmit[0];
              for (const el of candidates) {
                const text = toLower(normalizeText(el));
                if (keywords.some((k) => text.includes(k))) return el;
                const idClass = toLower(`${el.id || ''} ${el.className || ''}`);
                if (/(kaydet|save|submit)/.test(idClass)) return el;
              }
              return null;
            };

            const saveBtn = findSave();
            if (saveBtn) {
              saveBtn.click();
              return true;
            }
            return false;
          },
        });

        const clicked = results.some((r) => r?.result === true);
        setStatus(clicked ? 'Kaydet tıklandı' : 'Kaydet butonu bulunamadı');
      } catch (err) {
        console.error(err);
        setStatus('Hata: ' + err.message);
      }
    });
  }
)();
