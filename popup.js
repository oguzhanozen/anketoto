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

    // ── TEMIZLE fonksiyonu (hem buton hem doldur oncesi icin) ──
    async function clearSelections() {
      const tab = await getActiveTab();
      if (!tab) return;

      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: () => {
          // Standart radio
          document.querySelectorAll('input[type="radio"]:checked').forEach((r) => {
            r.checked = false;
            try {
              r.dispatchEvent(new Event('input', { bubbles: true }));
              r.dispatchEvent(new Event('change', { bubbles: true }));
            } catch {}
          });

          // Standart checkbox
          document.querySelectorAll('input[type="checkbox"]:checked').forEach((c) => {
            c.checked = false;
            try {
              c.dispatchEvent(new Event('input', { bubbles: true }));
              c.dispatchEvent(new Event('change', { bubbles: true }));
            } catch {}
          });

          // ARIA role="radio" — attribute sifirla, click tetikleme
          document.querySelectorAll('[role="radio"][aria-checked="true"]').forEach((el) => {
            el.setAttribute('aria-checked', 'false');
            el.classList.remove('selected', 'checked', 'active');
            try {
              el.dispatchEvent(new Event('change', { bubbles: true }));
            } catch {}
          });

          // ARIA role="option" — attribute sifirla
          document.querySelectorAll('[role="option"][aria-selected="true"], [role="option"][aria-checked="true"]').forEach((el) => {
            el.setAttribute('aria-selected', 'false');
            el.setAttribute('aria-checked', 'false');
            el.classList.remove('selected', 'checked', 'active');
            try {
              el.dispatchEvent(new Event('change', { bubbles: true }));
            } catch {}
          });

          // ARIA role="checkbox" — attribute sifirla
          document.querySelectorAll('[role="checkbox"][aria-checked="true"]').forEach((el) => {
            el.setAttribute('aria-checked', 'false');
            el.classList.remove('selected', 'checked', 'active');
            try {
              el.dispatchEvent(new Event('change', { bubbles: true }));
            } catch {}
          });
        },
      });
    }

    // ── DOLDUR butonu ──
    document.getElementById('fill').addEventListener('click', async () => {
      const mode = document.querySelector('input[name="mode"]:checked').value;
      setStatus('Temizleniyor...');
      try {
        const tab = await getActiveTab();
        if (!tab) return;

        // Once temizle
        await clearSelections();

        setStatus('Dolduruluyor...');

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

            // ── 2) ARIA role="radio" / role="option" (tum element turleri) ──
            const ariaGroups = new Map();
            const ariaRadios = Array.from(document.querySelectorAll('[role="radio"], [role="option"]'))
              .filter((el) => el.tagName !== 'INPUT'); // standart radiolarla cakismasin

            for (const r of ariaRadios) {
              const group = r.closest('[role="radiogroup"], [role="listbox"], [role="list"]');
              const key = group
                ? `aria:${group.getAttribute('aria-labelledby') || group.getAttribute('aria-label') || group.getAttribute('data-params') || Array.from(document.querySelectorAll('[role="radiogroup"], [role="listbox"], [role="list"]')).indexOf(group)}`
                : `aria:solo:${Math.random()}`;
              if (!ariaGroups.has(key)) ariaGroups.set(key, []);
              ariaGroups.get(key).push(r);
            }

            for (const list of ariaGroups.values()) {
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

            // ── 3) ARIA role="checkbox" (tum element turleri) ──
            const ariaCheckboxes = Array.from(document.querySelectorAll('[role="checkbox"]'))
              .filter((el) => el.tagName !== 'INPUT');

            // Checkboxlari gruplarina gore topla (parent container bazinda)
            const cbGroups = new Map();
            for (const cb of ariaCheckboxes) {
              const parent = cb.parentElement;
              const key = parent ? `cbg:${Array.from(document.querySelectorAll('*')).indexOf(parent)}` : `cbg:solo:${Math.random()}`;
              if (!cbGroups.has(key)) cbGroups.set(key, []);
              cbGroups.get(key).push(cb);
            }

            for (const list of cbGroups.values()) {
              if (selectedMode === 'max') {
                // Sadece son secenegi isaretle
                const target = list[list.length - 1];
                if (target && target.getAttribute('aria-checked') !== 'true') {
                  target.click();
                  radioMarkedCount++;
                }
              } else if (selectedMode === 'min') {
                // Sadece ilk secenegi isaretle
                const target = list[0];
                if (target && target.getAttribute('aria-checked') !== 'true') {
                  target.click();
                  radioMarkedCount++;
                }
              } else {
                // random: her birini %50 olasilikla isaretle
                for (const cb of list) {
                  if (cb.getAttribute('aria-checked') !== 'true' && Math.random() >= 0.5) {
                    cb.click();
                    radioMarkedCount++;
                  }
                }
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

    // ── TEMİZLE butonu ──
    document.getElementById('clear').addEventListener('click', async () => {
      setStatus('Temizleniyor...');
      try {
        await clearSelections();
        setStatus('Temizlendi');
      } catch (err) {
        console.error(err);
        setStatus('Hata: ' + err.message);
      }
    });
  }
)();
