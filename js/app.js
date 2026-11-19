  app.querySelector('#fetchHsk').onclick = async () => {
    const st = app.querySelector('#fetchStatus');
    st.textContent = 'Загрузка базы HSK 1–4...';
    try {
      const res = await fetch('./hsk.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const parsed = await res.json();
      saveVocab(parsed);
      st.textContent = 'Готово! Сохранено ' + parsed.length + ' слов HSK 1–4 в память устройства.';
    } catch (e) {
      st.textContent = 'Ошибка: ' + e.message;
    }
  };
