(() => {
  const enrich = () => {
    const host = document.querySelector('#rrows');
    if (!host) return;
    let state;
    try { state = JSON.parse(localStorage.getItem('ff14-770') || 'null'); } catch { return; }
    if (!state) return;
    const active = document.querySelector('#filters button.active')?.dataset.f || 'all';
    const recipes = state.r.filter(r => active === 'all' || r.t === active);
    host.querySelectorAll('.recipe').forEach((node, index) => {
      const recipe = recipes[index];
      if (!recipe || node.querySelector('.nbb-data')) return;
      const data = document.createElement('div');
      data.className = 'meta nbb-data';
      data.textContent = `物品 ID ${recipe.itemId || '自定义'} · 物品等级 ${recipe.lv || '—'}`;
      node.appendChild(data);
    });
  };
  setInterval(enrich, 250);
})();
