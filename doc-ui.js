(() => {
  const iconRoot = 'file:///E:/ff14/%E5%88%B6%E4%BD%9C/ff14%E9%87%91%E8%9D%B6%E5%87%86%E5%A4%87%E6%96%87%E4%BB%B6/%E8%81%8C%E4%B8%9A%E5%9B%BE%E6%A0%87/';
  const groups = [
    ['防护职业','1、防护职业/防护职业.png','骑士 · 战士 · 黑骑 · 绝枪'],
    ['治疗职业','2、治疗职业/治疗职业.png','白魔 · 学者 · 占星 · 贤者'],
    ['制敌 DPS','3、制敌DPS/制敌DPS.png','龙骑 · 镰刀'],
    ['强袭 DPS','4、强袭DPS/强袭DPS.png','武僧 · 武士'],
    ['游击 DPS','5、游击DPS/游击DPS.png','忍者 · 蝰蛇'],
    ['远敏 DPS','6、远敏DPS/远敏DPS.png','诗人 · 机工 · 舞者'],
    ['法系 DPS','7、法系DPS/法系DPS.png','黑魔 · 召唤 · 赤魔 · 画家']
  ];
  const style = document.createElement('style');
  style.textContent = `.doc-kpi{grid-template-columns:repeat(6,1fr)!important}.job-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.job-tile{display:flex;align-items:center;gap:9px;border:1px solid #dce4ea;border-radius:9px;padding:10px;background:linear-gradient(135deg,#fafdff,#edf5f8);cursor:pointer}.job-tile:hover{border-color:#2b7d92;box-shadow:0 5px 14px #1e435b18}.job-tile img{width:32px;height:32px;object-fit:contain}.job-tile b{display:block;font-size:13px}.job-tile span{display:block;font-size:10px;color:#74808c;margin-top:2px}@media(max-width:900px){.doc-kpi{grid-template-columns:repeat(3,1fr)!important}.job-grid{grid-template-columns:repeat(2,1fr)}}`;
  document.head.appendChild(style);
  const money = n => new Intl.NumberFormat('zh-CN',{maximumFractionDigits:0}).format(Math.round(n || 0)) + ' G';
  const date = new Date();
  const tick = () => {
    let state; try { state = JSON.parse(localStorage.getItem('ff14-770') || 'null'); } catch { return; }
    if (!state || !document.querySelector('#home')) return;
    const sold = (state.l || []).filter(x => x.type === '出售');
    const today = new Date().toISOString().slice(0,10), month = today.slice(0,7);
    const calc = rows => ({revenue: rows.reduce((s,x)=>s+x.amount,0),cost: rows.reduce((s,x)=>s+(x.cost||0),0),profit: rows.reduce((s,x)=>s+(x.profit||0),0)});
    const d = calc(sold.filter(x => x.date === today)), m = calc(sold.filter(x => x.date?.startsWith(month))), a = calc(sold);
    const metrics = document.querySelector('#metrics');
    if (metrics) {
      metrics.dataset.documentStyle = '1'; metrics.classList.add('doc-kpi');
      metrics.innerHTML = [['今日营业额',d.revenue],['本月营业额',m.revenue],['累计营业额',a.revenue],['累计成本',a.cost],['累计利润',a.profit],['出售流水',sold.length+' 笔']].map(([n,v]) => `<div class="card metric"><label>${n}</label><b class="${n.includes('利润')&&v<0?'neg':'pos'}">${typeof v==='number'?money(v):v}</b></div>`).join('');
    }
    if (!document.querySelector('#job-categories')) {
      const panel = document.createElement('div'); panel.id='job-categories'; panel.className='card panel';
      panel.innerHTML = '<div class="ph"><h2>770 HQ 战斗职业装备</h2><span class="hint">选择职业类别查看可售装备与制作配方</span></div><div class="job-grid">'+groups.map(([n,img,j])=>`<div class="job-tile" title="${j}"><img src="${iconRoot+img}" alt="${n}"><div><b>${n}</b><span>${j}</span></div></div>`).join('')+'</div><div class="notice">750 HQ 生产 / 采集装备已在“装备配方”中单列；材料、晶簇、成品成本均按当前库存和市场快照核算。</div>';
      document.querySelector('#home .grid')?.before(panel);
    }
  };
  setInterval(tick, 250);
})();
