(() => {
  const allowed = new Set(['制作', '出售']);
  const cleanStoredLogs = () => {
    try {
      const state = JSON.parse(localStorage.getItem('ff14-770') || 'null');
      if (!state?.l) return;
      const clean = state.l.filter(row => allowed.has(row.type));
      if (clean.length !== state.l.length) {
        state.l = clean;
        localStorage.setItem('ff14-770', JSON.stringify(state));
      }
    } catch (_) {}
  };
  cleanStoredLogs();
  const updateUi = () => {
    const ledgerTitle = document.querySelector('#ledger h1');
    const ledgerSub = document.querySelector('#ledger .sub');
    if (ledgerTitle) ledgerTitle.textContent = '制作与销售记录';
    if (ledgerSub) ledgerSub.textContent = '仅保留制作成本与装备销售的历史记录。';
    document.querySelectorAll('#lrows tr').forEach(row => {
      if (!row.textContent.includes('制作入库') && !row.textContent.includes('装备出售')) row.remove();
    });
    const header = document.querySelector('#materials thead tr');
    if (header && !header.dataset.level) {
      const th = document.createElement('th'); th.textContent = '物品等级';
      header.insertBefore(th, header.children[2]); header.dataset.level = '1';
    }
    let state; try { state = JSON.parse(localStorage.getItem('ff14-770') || 'null'); } catch (_) { return; }
    document.querySelectorAll('#mrows tr').forEach(row => {
      if (row.dataset.level || !state) return;
      const id = row.children[1]?.textContent.trim();
      const material = state.m.find(x => String(x.uid) === id);
      const td = document.createElement('td');
      td.textContent = material?.ilv ? `品级 ${material.ilv}` : '—';
      row.insertBefore(td, row.children[2]); row.dataset.level = '1';
    });
  };
  setInterval(updateUi, 200);
})();
