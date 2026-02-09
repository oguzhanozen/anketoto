(
  async function () {
    const statusEl = document.getElementById('status');
    const setStatus = (txt) => (statusEl.textContent = txt);

    document.getElementById('run').addEventListener('click', async () => {
      setStatus('Çalıştırılıyor...');
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
          setStatus('Aktif sekme bulunamadı.');
          return;
        }

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          func: () => {
            const normalizeText = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
            const toLower = (s) => s?.toLocaleLowerCase('tr') || '';

            let radioMarkedCount = 0;
            const radiosAll = Array.from(document.querySelectorAll('input[type="radio"]'));

            // Gruplara ayır (name ile), yoksa her radio'yu tek grup say
            const groups = new Map();
            for (const r of radiosAll) {
              const key = r.name ? `name:${r.name}` : r.closest('label') ? `label:${normalizeText(r.closest('label'))}` : `id:${r.id || Math.random()}`;
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key).push(r);
            }

            for (const list of groups.values()) {
              // Öncelik: value="5" → en yüksek sayısal değer → son seçenek
              let candidate = list.find((r) => String(r.value).trim() === '5');
              if (!candidate) {
                const numeric = list
                  .map((r) => ({ r, v: parseFloat(String(r.value).replace(',', '.')) }))
                  .filter((o) => !Number.isNaN(o.v));
                if (numeric.length) {
                  candidate = numeric.reduce((a, b) => (a.v >= b.v ? a : b)).r;
                }
              }
              if (!candidate) candidate = list[list.length - 1];

              if (candidate) {
                const label = candidate.id ? document.querySelector(`label[for="${candidate.id}"]`) : candidate.closest('label');
                (label || candidate).click();
                // Olası framework’ler için input/change olaylarını tetikle
                try {
                  candidate.dispatchEvent(new Event('input', { bubbles: true }));
                  candidate.dispatchEvent(new Event('change', { bubbles: true }));
                } catch {}
                radioMarkedCount++;
              }
            }

            console.log(`${radioMarkedCount} soru isaretlendi`);

            // Kaydet/Gönder butonu bulma
            const keywords = ['kaydet', 'gönder', 'submit', 'bitir', 'tamam', 'kaydet ve devam', 'kayıt', 'save', 'finish'];
            const candidates = Array.from(
              document.querySelectorAll(
                'button, input[type="button"], input[type="submit"], [role="button"], a.button, a[onclick]'
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
              setTimeout(() => saveBtn.click(), 500);
              console.log('kaydedildi');
              return { radioMarkedCount, clicked: true };
            }
            console.log('Kaydet butonu bulunamadı');
            return { radioMarkedCount, clicked: false };
          },
        });

        // Çerçevelerden gelen sonuçları özetle
        const summary = results
          .map((r) => r?.result)
          .filter(Boolean)
          .reduce(
            (acc, cur) => {
              acc.totalMarked += cur.radioMarkedCount || 0;
              acc.anyClicked = acc.anyClicked || !!cur.clicked;
              return acc;
            },
            { totalMarked: 0, anyClicked: false }
          );

        setStatus(
          `İşaretlenen: ${summary.totalMarked} | Kaydet: ${summary.anyClicked ? 'tıklandı' : 'bulunamadı'}`
        );
      } catch (err) {
        console.error(err);
        setStatus('Hata: ' + err.message);
      }
    });
  }
)();
