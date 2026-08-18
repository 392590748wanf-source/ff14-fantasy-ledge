window.addEventListener('load', () => {
  const state = { page: 'home', type: null, expanded: false, submarineExpanded: false, submarineView: 'summary', submarinePartsOpen: false, guideView: 'crystals', guideExpanded: false, selectedMaterial: null, basicCategory: 'equipment', otherSearch: '', equipmentGroups: {}, equipmentSections: {}, guideCategories: {}, marketRefreshing: false, marketMessage: '', equipmentCombatTier: '770', equipmentGatheringTier: '750', submarineGroups: {}, itemIndexLoading: false };
  const data = JSON.parse(localStorage.getItem('ff14-770') || '{"m":[],"r":[],"p":{},"l":[]}');
  const savedMaterials = JSON.parse(localStorage.getItem('ff14-material-state') || 'null');
  if (savedMaterials) data.m = savedMaterials;
  const purchases = JSON.parse(localStorage.getItem('ff14-material-purchases') || '[]');
  const prices = JSON.parse(localStorage.getItem('ff14-fantasy-prices') || '{}');
  const submarineTicketSettings = JSON.parse(localStorage.getItem('ff14-submarine-ticket-settings') || '{"defaultUnitCost":80}');
  if (!(Number(submarineTicketSettings.defaultUnitCost) > 0)) submarineTicketSettings.defaultUnitCost = 80;
  const otherMaterialIds = JSON.parse(localStorage.getItem('ff14-other-material-ids') || '[]');
  const submarineStocks = JSON.parse(localStorage.getItem('ff14-submarine-stocks') || '{}');
  const submarineSales = JSON.parse(localStorage.getItem('ff14-submarine-sales') || '[]');
  const submarineSuiteSales = JSON.parse(localStorage.getItem('ff14-submarine-suite-sales') || '[]');
  const submarineOperations = JSON.parse(localStorage.getItem('ff14-submarine-operations') || '[]');
  const npcMaterialConfig = JSON.parse(localStorage.getItem('ff14-submarine-npc-materials') || '{"added":{},"disabled":[]}');
  const submarineSuites = JSON.parse(localStorage.getItem('ff14-submarine-suites') || 'null') || [
    { id: '1111', code: '1111', priceKey: 'submarine-suite-1111' },
    { id: '1121', code: '1121', priceKey: 'submarine-suite-1121' },
    { id: '3004', code: '3004', priceKey: 'submarine-suite-3004' },
    { id: '3024', code: '3024', priceKey: 'submarine-suite-3024' },
    { id: '3124', code: '3124', priceKey: 'submarine-suite-3124' },
    { id: '3124m', code: '3124', modified: true, label: '3124改', priceKey: 'submarine-suite-3124m' },
    { id: '4254m', code: '4254', modified: true, label: '4254改', priceKey: 'submarine-suite-4254m' },
    { id: '4224m', code: '4224', modified: true, label: '4224改', priceKey: 'submarine-suite-4224m' }
  ];
  const planCache = new Map();
  // 潜水艇推荐分类和后续制作成本必须使用同一份实时来源比价结果。
  const submarineSourceCache = new Map();
  const submarineCraftCostCache = new Map();
  const invalidatePlans = () => { planCache.clear(); submarineSourceCache.clear(); submarineCraftCostCache.clear(); };
  const guideIndexCache = { equipment: new Map(), submarine: null, catalog: null, membership: new Map() };
  const invalidateGuideIndexes = () => { guideIndexCache.equipment.clear(); guideIndexCache.submarine = null; guideIndexCache.catalog = null; guideIndexCache.membership.clear(); };
  const itemIndex = () => window.FF14_ITEM_INDEX || [];
  const loadItemIndex = () => {
    if (window.FF14_ITEM_INDEX || state.itemIndexLoading) return;
    state.itemIndexLoading = true;
    const script = document.createElement('script');
    script.src = 'item-index.js';
    script.onload = () => { state.itemIndexLoading = false; if (state.page === 'guide' && state.basicCategory === 'other') renderGuide(); };
    script.onerror = () => { state.itemIndexLoading = false; state.marketMessage = '道具索引加载失败，请稍后重试。'; renderGuide(); };
    document.head.append(script);
  };
  const money = n => new Intl.NumberFormat('zh-CN').format(Math.round(n || 0)) + ' G';
  const marketPriceLabel = material => {
    if (Number(material?.mp) > 0) {
      if (material.marketStatus === 'listing-average') return money(material.mp) + '（在售均价）';
      if (material.marketStatus === 'stale') return money(material.mp) + '（最近快照）';
      return money(material.mp);
    }
    if (material?.marketStatus === 'no-average') return '暂无成交均价';
    if (material?.marketStatus === 'not-found') return '无市场数据';
    return '未获取';
  };
  const chinaDate = value => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value instanceof Date ? value : new Date(value));
    const find = type => parts.find(part => part.type === type)?.value;
    return `${find('year')}-${find('month')}-${find('day')}`;
  };
  const today = () => chinaDate(new Date());
  const shiftDate = (date, days) => { const [year, month, day] = String(date).split('-').map(Number); return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10); };
  const stock = id => data.p[id] || { q: 0, v: 0, made: 0, sold: 0 };
  const save = () => {
    localStorage.setItem('ff14-770', JSON.stringify(data));
    localStorage.setItem('ff14-fantasy-prices', JSON.stringify(prices));
    localStorage.setItem('ff14-submarine-ticket-settings', JSON.stringify(submarineTicketSettings));
    localStorage.setItem('ff14-material-state', JSON.stringify(data.m));
    localStorage.setItem('ff14-material-purchases', JSON.stringify(purchases));
    localStorage.setItem('ff14-other-material-ids', JSON.stringify(otherMaterialIds));
    localStorage.setItem('ff14-submarine-stocks', JSON.stringify(submarineStocks));
    localStorage.setItem('ff14-submarine-sales', JSON.stringify(submarineSales));
    localStorage.setItem('ff14-submarine-suite-sales', JSON.stringify(submarineSuiteSales));
    localStorage.setItem('ff14-submarine-operations', JSON.stringify(submarineOperations));
    localStorage.setItem('ff14-submarine-npc-materials', JSON.stringify(npcMaterialConfig));
    localStorage.setItem('ff14-submarine-suites', JSON.stringify(submarineSuites));
  };
  const recipe = id => data.r.find(row => row.id === id);
  const recipes = (type, job) => data.r.filter(row => row.t === type && (!job || row.j === job));
  const sales = () => data.l.filter(row => row.type === '出售');
  const jobNames = {
    '职业 38':'骑士', '职业 41':'武僧', '职业 44':'战士', '职业 47':'龙骑士',
    '职业 50':'诗人', '职业 53':'白魔法师', '职业 55':'黑魔法师', '职业 69':'学者',
    '职业 29':'召唤师', '职业 93':'忍者', '职业 98':'暗黑骑士', '职业 96':'机工士',
    '职业 99':'占星术士', '职业 111':'武士', '职业 112':'赤魔法师', '职业 149':'绝枪战士',
    '职业 150':'舞者', '职业 180':'钐镰客', '职业 181':'贤者', '职业 196':'蝰蛇剑士',
    '职业 197':'绘灵法师', '职业 9':'刻木匠', '职业 10':'锻铁匠', '职业 11':'铸甲匠',
    '职业 12':'雕金匠', '职业 13':'制革匠', '职业 14':'裁衣匠', '职业 15':'炼金术士',
    '职业 16':'烹饪师', '职业 17':'采矿工', '职业 18':'园艺工', '职业 19':'捕鱼人'
  };
  const jobIconPaths = {
    '职业 38':'1、防护职业/骑士.png', '职业 44':'1、防护职业/战士.png', '职业 98':'1、防护职业/黑骑.png', '职业 149':'1、防护职业/绝枪.png',
    '职业 53':'2、治疗职业/白魔.png', '职业 69':'2、治疗职业/学者.png', '职业 99':'2、治疗职业/占星.png', '职业 181':'2、治疗职业/贤者.png',
    '职业 47':'3、制敌DPS/龙骑.png', '职业 180':'3、制敌DPS/镰刀.png', '职业 41':'4、强袭DPS/武僧.png', '职业 111':'4、强袭DPS/武士.png',
    '职业 93':'5、游击DPS/忍者.png', '职业 196':'5、游击DPS/蝰蛇.png', '职业 50':'6、远敏DPS/诗人.png', '职业 96':'6、远敏DPS/机工.png', '职业 150':'6、远敏DPS/舞者.png',
    '职业 55':'7、法系DPS/黑魔.png', '职业 29':'7、法系DPS/召唤.png', '职业 112':'7、法系DPS/赤魔.png', '职业 197':'7、法系DPS/画家.png',
    '职业 9':'刻木匠.png', '职业 10':'锻铁匠.png', '职业 11':'铸甲匠.png', '职业 12':'雕金匠.png', '职业 13':'制革匠.png', '职业 14':'裁衣匠.png', '职业 15':'炼金术士.png', '职业 16':'烹饪师.png', '职业 17':'采矿工.png', '职业 18':'园艺工.png', '职业 19':'钓鱼人.png'
  };
  const groupIconPaths = { '防护职业':'1、防护职业/防护职业.png', '治疗职业':'2、治疗职业/治疗职业.png', '制敌 DPS':'3、制敌DPS/制敌DPS.png', '强袭 DPS':'4、强袭DPS/强袭DPS.png', '游击 DPS':'5、游击DPS/游击DPS.png', '远敏 DPS':'6、远敏DPS/远敏DPS.png', '法系 DPS':'7、法系DPS/法系DPS.png', '大地使者':'采矿工.png', '能工巧匠':'刻木匠.png' };
  const iconMarkup = (path, label) => `<span class="job-badge"><img src="assets/job-icons/${path}" alt="${label}" onerror="this.remove()"><span>${label.slice(0, 1)}</span></span>`;
  const crystalSpecs = [
    ['火', 2, 8, 14], ['冰', 3, 9, 15], ['风', 4, 10, 16],
    ['土', 5, 11, 17], ['雷', 6, 12, 18], ['水', 7, 13, 19]
  ];
  const baseMaterials = window.FF14_BASE_MATERIALS || { n: {}, b: {}, d: {}, k: {}, meta: {} };
  const submarineData = window.FF14_SUBMARINE_DATA || { parts: [], g: {}, n: {}, leaves: [] };
  const retainerData = window.FF14_RETAINER_DATA || {};
  const materialSources = window.FF14_MATERIAL_SOURCES || {};
  const exchangeSources = window.FF14_EXCHANGE_SOURCES || { carriers: {}, routes: [] };
  let npcMaterialIndex = null;
  let npcComparisonReady = false;
  const npcComparisonCache = new Map();
  const invalidateNpcMaterials = () => { npcMaterialIndex = null; npcComparisonCache.clear(); invalidateGuideIndexes(); invalidatePlans(); };
  const npcMaterialByUid = () => {
    if (npcMaterialIndex) return npcMaterialIndex;
    const disabled = new Set((npcMaterialConfig.disabled || []).map(String));
    const builtIn = Object.entries(materialSources)
      .filter(([uid, source]) => source.npc && submarineData.n?.[String(uid)] && !disabled.has(String(uid)))
      .map(([uid, source]) => [String(uid), { uid: String(uid), name: source.name, ...source.npc, builtIn: true }]);
    npcMaterialIndex = Object.fromEntries([...builtIn, ...Object.entries(npcMaterialConfig.added || {}).map(([uid, spec]) => [String(uid), { uid: String(uid), ...spec }])]);
    return npcMaterialIndex;
  };
  const npcCandidate = materialOrUid => npcMaterialByUid()[String(typeof materialOrUid === 'object' ? materialOrUid?.uid : materialOrUid)];
  const npcMaterial = materialOrUid => {
    const uid = String(typeof materialOrUid === 'object' ? materialOrUid?.uid : materialOrUid), candidate = npcCandidate(uid);
    if (!candidate || !npcComparisonReady) return candidate;
    return npcComparison(uid).recommendation === 'NPC' ? candidate : undefined;
  };
  const baseMaterialMeta = baseMaterials.meta || {};
  const isCrystal = material => /之(碎晶|水晶|晶簇)$/.test(material.n);
  const ensureCrystals = () => crystalSpecs.forEach(([element, shard, crystal, cluster]) => {
    [[shard, '碎晶'], [crystal, '水晶'], [cluster, '晶簇']].forEach(([uid, suffix]) => {
      if (!data.m.some(material => String(material.uid) === String(uid))) {
        data.m.push({ id: 'crystal-' + uid, n: element + '之' + suffix, uid: String(uid), c: 0, mp: 0, u: '' });
      }
    });
  });
  ensureCrystals();
  const ensureBaseMaterials = () => Object.entries(baseMaterials.n).forEach(([uid, name]) => {
    if (!data.m.some(material => String(material.uid) === String(uid))) {
      data.m.push({ id: 'base-' + uid, n: name, uid: String(uid), c: 0, mp: 0, u: '' });
    }
  });
  ensureBaseMaterials();
  const ensureSubmarineMaterials = () => Object.entries(submarineData.n || {}).forEach(([uid, name]) => {
    const fixed = npcMaterial(uid), material = data.m.find(item => String(item.uid) === String(uid));
    if (!material) data.m.push({ id: 'submarine-' + uid, n: name, uid: String(uid), c: fixed?.price || 0, mp: 0, u: '', fixedNpcPrice: fixed?.price, npcSource: fixed?.source });
    else if (fixed) { material.fixedNpcPrice = fixed.price; material.npcSource = fixed.source; material.c = fixed.price; }
    else { delete material.fixedNpcPrice; delete material.npcSource; }
  });
  ensureSubmarineMaterials();
  const ensureExchangeMaterials = () => Object.entries(exchangeSources.carriers || {}).forEach(([uid, spec]) => {
    if (!data.m.some(material => String(material.uid) === String(uid))) data.m.push({ id: 'exchange-' + uid, n: spec.name, uid: String(uid), c: 0, mp: 0, u: '', exchangeCarrier: true });
  });
  ensureExchangeMaterials();
  // 物品主数据由装备/潜水艇配方索引提供；来源索引不能单独注入推荐材料。
  const purchaseRows = material => purchases.filter(row => row.materialId === material.id);
  const purchaseAverage = material => {
    const rows = purchaseRows(material), quantity = rows.reduce((sum, row) => sum + row.quantity, 0);
    return quantity ? rows.reduce((sum, row) => sum + row.total, 0) / quantity : 0;
  };
  // 采购均价会合并历史兑换入账；来源比价中的“市场采购”只比较直接市场购买，避免
  // 已经按薰衣草 / 天穹票入账的成本被误标为市场采购。
  const directPurchaseAverage = material => {
    const rows = purchaseRows(material).filter(row => row.kind !== 'exchange');
    const quantity = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    return quantity ? rows.reduce((sum, row) => sum + Number(row.total || 0), 0) / quantity : 0;
  };
  // NPC 材料允许保留自有采购记录。仅比较有效的正数价格，始终采用较低成本。
  const npcCostChoice = (materialOrUid, spec = npcCandidate(materialOrUid)) => {
    const material = typeof materialOrUid === 'object'
      ? materialOrUid
      : data.m.find(item => String(item.uid) === String(materialOrUid));
    const npcPrice = Number(spec?.price || 0), purchasePrice = Number(material ? purchaseAverage(material) : 0);
    if (purchasePrice > 0 && (!npcPrice || purchasePrice < npcPrice)) return { price: purchasePrice, source: '采购平均价' };
    if (npcPrice > 0) return { price: npcPrice, source: 'NPC 采购价' };
    if (purchasePrice > 0) return { price: purchasePrice, source: '采购平均价' };
    return { price: 0, source: '—' };
  };
  const voucherCarrierIds = new Set(Object.keys(exchangeSources.carriers || {}).map(String));
  // 凭证仅用于记录某一笔兑换采购的约定成本，不维护囤货数量或持有成本。
  const exchangeRoutesFor = uid => (exchangeSources.routes || []).map((route, routeIndex) => ({ ...route, routeIndex, quantity: Number(route.outputs?.[String(uid)] || 0) }))
    .filter(route => route.quantity > 0);
  const directSourceChoice = material => {
    if (!material) return { price: 0, source: '—' };
    const purchase = purchaseAverage(material), npc = npcCandidate(material);
    // 已有采购均价（含兑换采购）优先；NPC 材料仍按用户要求与采购价取更低者。
    if (purchase > 0 && !npc?.price) return { price: purchase, source: '采购平均价', type: 'purchase' };
    const choices = [];
    if (purchase > 0) choices.push({ price: purchase, source: '采购平均价', type: 'purchase' });
    if (Number(npc?.price) > 0) choices.push({ ...npcCostChoice(material, npc), type: 'npc' });
    return choices.sort((left, right) => left.price - right.price)[0] || { price: 0, source: '—' };
  };
  const syncPurchaseCosts = () => {
    data.m.forEach(material => {
      material.c = directSourceChoice(material).price || 0;
      delete material.q;
    });
    invalidatePlans();
    invalidateGuideIndexes();
  };
  syncPurchaseCosts();
  const recipeByItemId = itemId => data.r.find(item => Number(item.itemId) === Number(itemId));
  const componentList = entries => entries.map(([itemId, qty = 1]) => {
    const found = recipeByItemId(itemId);
    return { item: found || { id: 'item-' + itemId, itemId: Number(itemId), n: materialName(itemId) }, qty: Number(qty) || 1, itemId: Number(itemId) };
  });
  const row = (id, group, label, entries, priceKey, indent = false, pricePart = 'total', job = null) => ({
    id, group, label, components: componentList(entries), priceKey, indent, pricePart, job
  });
  const combatBlueprints = [
    ['防护职业', ['职业 38','职业 44','职业 98','职业 149'], [49271,49272,49273,49274,49275], [[49306,1],[49311,1],[49316,1],[49321,2]], { '职业 38':[49249,49270], '职业 44':[49251], '职业 98':[49259], '职业 149':[49264] }],
    ['治疗职业', ['职业 53','职业 69','职业 99','职业 181'], [49296,49297,49298,49299,49300], [[49309,1],[49314,1],[49319,1],[49324,2]], { '职业 53':[49254], '职业 69':[49256], '职业 99':[49261], '职业 181':[49267] }],
    ['制敌 DPS', ['职业 47','职业 180'], [49276,49277,49278,49279,49280], [[49307,1],[49312,1],[49317,1],[49322,2]], { '职业 47':[49252], '职业 180':[49266] }],
    ['强袭 DPS', ['职业 41','职业 111'], [49281,49282,49283,49284,49285], [[49307,1],[49312,1],[49317,1],[49322,2]], { '职业 41':[49250], '职业 111':[49262] }],
    ['游击 DPS', ['职业 93','职业 196'], [49291,49292,49293,49294,49295], [[49308,1],[49313,1],[49318,1],[49323,2]], { '职业 93':[49258], '职业 196':[49268] }],
    ['远敏 DPS', ['职业 50','职业 96','职业 150'], [49286,49287,49288,49289,49290], [[49308,1],[49313,1],[49318,1],[49323,2]], { '职业 50':[49253], '职业 96':[49260], '职业 150':[49265] }],
    ['法系 DPS', ['职业 55','职业 29','职业 112','职业 197'], [49301,49302,49303,49304,49305], [[49310,1],[49315,1],[49320,1],[49325,2]], { '职业 55':[49255], '职业 29':[49257], '职业 112':[49263], '职业 197':[49269] }]
  ];
  const gatheringBlueprints = [
    ['大地使者', ['职业 17','职业 18','职业 19'], [47189,47190,47191,47192,47193], [[47198,1],[47199,1],[47200,1],[47201,2]], { '职业 17':[47171,47182], '职业 18':[47172,47183], '职业 19':[47173] }],
    ['能工巧匠', ['职业 9','职业 10','职业 11','职业 12','职业 13','职业 14','职业 15','职业 16'], [47184,47185,47186,47187,47188], [[47194,1],[47195,1],[47196,1],[47197,2]], { '职业 9':[47163,47174], '职业 10':[47164,47175], '职业 11':[47165,47176], '职业 12':[47166,47177], '职业 13':[47167,47178], '职业 14':[47168,47179], '职业 15':[47169,47180], '职业 16':[47170,47181] }]
  ];
  const pairs = ids => ids.map(itemId => [itemId, 1]);
  const tableRows = type => {
    const all = [];
    if (type === '770') {
      combatBlueprints.forEach(([group, jobs, armor, accessory, weapons]) => {
        all.push({ header: group });
        jobs.forEach(job => {
          const weapon = pairs(weapons[job]);
          const jobRow = row('770-'+job, group, jobNames[job], [...pairs(armor), ...accessory, ...weapon], group+'-整套', true, 'total', job);
          jobRow.tool = row('770-'+job+'-weapon', group, jobNames[job]+'武器', weapon, group+'-'+job+'-武器', true, 'weapon', job);
          all.push(jobRow);
        });
        all.push(row('770-'+group+'-gear', group, '防具首饰', [...pairs(armor), ...accessory], group+'-防具首饰', false, 'gear'));
        all.push(row('770-'+group+'-armor', group, '防具', pairs(armor), group+'-防具', true, 'armor'));
        all.push(row('770-'+group+'-accessory', group, '首饰', accessory, group+'-首饰', true, 'accessory'));
      });
    } else {
      gatheringBlueprints.forEach(([group, jobs, armor, accessory, tools]) => {
        all.push({ header: group });
        jobs.forEach(job => {
          const tool = pairs(tools[job]);
          const jobRow = row('750-'+job, group, jobNames[job], [...pairs(armor), ...accessory, ...tool], group+'-全套', true, 'total', job);
          jobRow.tool = row('750-'+job+'-tool', group, jobNames[job]+'主副手', tool, group+'-'+job+'-主副手', true, 'weapon', job);
          all.push(jobRow);
        });
        all.push(row('750-'+group+'-gear', group, '防具首饰', [...pairs(armor), ...accessory], group+'-防具首饰', false, 'gear'));
        all.push(row('750-'+group+'-armor', group, group+'防具', pairs(armor), group+'-防具', true, 'armor'));
        all.push(row('750-'+group+'-accessory', group, group+'首饰', accessory, group+'-首饰', true, 'accessory'));
      });
    }
    return all.filter(item => item.header || item.components.some(component => component.item));
  };
  const graphRecipes = { ...(baseMaterials.g || {}), ...(submarineData.g || {}) };
  const DEFAULT_TICKET_UNIT_COST = 80;
  const ticketUnitCost = () => Number(submarineTicketSettings.defaultUnitCost) > 0
    ? Number(submarineTicketSettings.defaultUnitCost)
    : DEFAULT_TICKET_UNIT_COST;
  const sourceKindForRoute = route => route.kind === '天穹票兑换' ? '天穹票兑换' : '薰衣草/风茄兑换';
  const sourceLabelForRoute = route => {
    if (route.carrierId === '15857') return '薰衣草兑换';
    if (route.carrierId === '15858') return '风茄兑换';
    return /白钢/.test(route.label || '') ? '白钢兑换' : /黄铜/.test(route.label || '') ? '黄铜兑换' : '天穹票兑换';
  };
  const recommendationClass = choice => {
    if (!choice) return 'recommend-pending';
    if (choice.key === 'npc') return 'recommend-npc';
    if (choice.key === 'craft') return 'recommend-craft';
    if (choice.key === 'pending') return 'recommend-pending';
    if (choice.label === '薰衣草兑换') return 'recommend-lavender';
    if (choice.label === '风茄兑换') return 'recommend-pepper';
    if (choice.label === '白钢兑换') return 'recommend-white-steel';
    if (choice.label === '黄铜兑换') return 'recommend-yellow-brass';
    return 'recommend-market';
  };
  const recommendationTag = (choice, text = null) => `<span class="recommend-tag ${recommendationClass(choice)}">${text || `推荐：${choice?.label || '待补价'}`}</span>`;
  const isExchangeChoice = choice => Boolean(choice?.key && choice.key.startsWith('exchange-'));
  const staticSubmarineKind = material => {
    const uid = String(material?.uid || '');
    if (voucherCarrierIds.has(uid)) return '薰衣草/风茄兑换';
    // 此函数在启动期就会被 NPC 成本初始化调用，不能依赖后面才声明的分类辅助函数。
    const source = materialSources[uid] || {}, kinds = source.submarineKinds || [];
    const priority = ['NPC 购买材料', '常规采集品', '军票兑换', '薰衣草/风茄兑换', '天穹票兑换', '限时采集品', '怪物掉落', '潜水艇携带材料'];
    const baseKind = (source.equipmentKinds || []).includes('怪物掉落') ? '怪物掉落' : baseMaterials.k?.[uid] || '常规采集品';
    const fallback = baseKind === '神典石材料' ? '军票兑换' : baseKind === '灵砂' ? '限时采集品' : baseKind;
    return priority.find(kind => kinds.includes(kind)) || fallback;
  };
  // 非自制取得方式：市场、NPC 与兑换均为成本终点，不继续展开配方。
  const submarineNonCraftSourceOptions = material => {
    if (!material) return [];
    const uid = String(material.uid), options = [], directPurchase = directPurchaseAverage(material), market = Number(material.mp || 0), nativeKind = staticSubmarineKind(material);
    if (directPurchase > 0) options.push({ key: 'direct-purchase', kind: nativeKind, label: '市场采购', source: '采购平均价', price: directPurchase, formula: '全部历史直接采购合价 ÷ 数量' });
    else if (market > 0) options.push({ key: 'direct-market', kind: nativeKind, label: '市场采购', source: 'Universalis 市场均价', price: market, formula: 'Universalis 中国区市场均价' });
    else options.push({ key: 'direct-missing', kind: nativeKind, label: '市场采购', source: '等待市场价 / 未录入采购价', price: 0, unavailable: true });
    const npc = npcCandidate(uid);
    if (Number(npc?.price || 0) > 0) options.push({ key: 'npc', kind: 'NPC 购买材料', label: 'NPC 购买', source: npc.source || 'NPC 商店', price: Number(npc.price), formula: 'NPC 售卖价' });
    exchangeRoutesFor(uid).forEach(route => {
      if (route.carrierId) {
        const carrier = data.m.find(item => String(item.uid) === String(route.carrierId));
        const carrierPurchase = carrier ? purchaseAverage(carrier) : 0, carrierMarket = Number(carrier?.mp || 0), carrierPrice = carrierPurchase || carrierMarket;
        options.push({ key: 'exchange-' + route.routeIndex, kind: sourceKindForRoute(route), label: sourceLabelForRoute(route), source: carrier?.n || route.label, price: carrierPrice > 0 ? carrierPrice / route.quantity : 0, unavailable: !(carrierPrice > 0), formula: carrierPrice > 0 ? `${carrierPurchase > 0 ? '凭证采购均价' : '凭证市场均价'} ${money(carrierPrice)} ÷ ${route.quantity}` : '等待凭证市场价 / 采购价' });
      } else {
        const unitCost = ticketUnitCost(), ticketCost = Number(route.ticketCost || 40) * unitCost;
        options.push({ key: 'exchange-' + route.routeIndex, kind: sourceKindForRoute(route), label: sourceLabelForRoute(route), source: route.label, price: ticketCost / route.quantity, formula: `${Number(route.ticketCost || 40)} 张 × ${money(unitCost)} ÷ ${route.quantity}` });
      }
    });
    return options;
  };
  const lowestSubmarineOption = (options, fallbackKind) => {
    const valid = options.filter(option => Number(option.price) > 0);
    valid.sort((left, right) => Number(left.price) - Number(right.price) || (left.kind === fallbackKind ? -1 : 1));
    return valid[0] || { key: 'pending', kind: fallbackKind, label: '待补价', source: '未获取有效价格', price: 0, unavailable: true };
  };
  // 制作本体时，下级材料可选择市场、NPC、兑换或继续自制中成本最低的有效来源。
  // trail 仅用于递归防环；顶层结果单独缓存，避免来源比价与配方递归相互污染。
  const submarineCraftInputChoice = (uid, trail = new Set()) => {
    uid = String(uid);
    const material = data.m.find(item => String(item.uid) === uid) || { uid, n: materialName(uid) };
    const options = submarineNonCraftSourceOptions(material);
    if (!trail.has(uid) && graphRecipes[uid]?.length) {
      const craft = selfCraftUnitCost(uid, trail);
      options.push({ key: 'craft', kind: staticSubmarineKind(material), label: '自制（制作配方）', source: '递归制作配方', price: Number(craft || 0), unavailable: !(Number(craft) > 0), formula: craft ? '下级材料按最低有效来源递归计算' : '等待下级材料价格' });
    }
    return lowestSubmarineOption(options, staticSubmarineKind(material));
  };
  const submarineCraftInputBreakdown = (uid, trail = new Set()) => {
    uid = String(uid);
    const node = (graphRecipes[uid] || [])[0];
    if (!node || trail.has(uid)) return [];
    const next = new Set(trail); next.add(uid), output = Math.max(1, Number(node.y) || 1);
    const rows = [];
    for (let index = 0; index < node.a.length; index += 2) {
      const child = Number(node.a[index]), batchQuantity = Number(node.a[index + 1] || 0), quantity = batchQuantity / output;
      if (!child || !batchQuantity) continue;
      const choice = submarineCraftInputChoice(child, next);
      const unit = Number(choice.price || 0);
      rows.push({ uid: child, quantity, batchQuantity, choice, unit, total: unit * quantity, batchTotal: unit * batchQuantity });
    }
    return rows;
  };
  const selfCraftUnitCost = (uid, trail = new Set()) => {
    uid = String(uid);
    if (trail.has(uid)) return null;
    if (!trail.size && submarineCraftCostCache.has(uid)) return submarineCraftCostCache.get(uid);
    const node = (graphRecipes[uid] || [])[0];
    if (!node) return null;
    const rows = submarineCraftInputBreakdown(uid, trail);
    const value = rows.length && rows.every(row => row.unit > 0) ? rows.reduce((sum, row) => sum + row.total, 0) : null;
    if (!trail.size) submarineCraftCostCache.set(uid, value);
    return value;
  };
  // 装备配方继续沿用既有的纯递归口径；潜水艇才使用“下级取最低来源”的新规则。
  const equipmentCraftUnitCost = (uid, trail = new Set()) => {
    uid = String(uid);
    if (trail.has(uid)) return null;
    const node = (graphRecipes[uid] || [])[0];
    if (!node) {
      const npc = npcCandidate(uid), material = data.m.find(item => String(item.uid) === uid);
      if (npc?.price) return npcCostChoice(material || uid, npc).price || null;
      const price = material ? (purchaseAverage(material) || material.mp || 0) : 0;
      return price || null;
    }
    const next = new Set(trail); next.add(uid);
    let total = 0;
    for (let index = 0; index < node.a.length; index += 2) {
      const child = Number(node.a[index]), quantity = Number(node.a[index + 1]);
      if (!child || !quantity) continue;
      const price = equipmentCraftUnitCost(child, next);
      if (price == null) return null;
      total += price * quantity;
    }
    return total / Math.max(1, Number(node.y) || 1);
  };
  // 所有可用取得方式都在此处展开。0、缺价和无法递归的路线仅保留说明，不参与最低价选择。
  const submarineSourceOptions = material => {
    if (!material) return [];
    const uid = String(material.uid), options = submarineNonCraftSourceOptions(material);
    if (graphRecipes[uid]?.length) {
      const craft = selfCraftUnitCost(uid);
      options.push({ key: 'craft', kind: staticSubmarineKind(material), label: '自制（制作配方）', source: '递归制作配方', price: Number(craft || 0), unavailable: !(Number(craft) > 0), formula: craft ? '下级材料按最低有效来源递归计算' : '等待下级材料价格' });
    }
    return options;
  };
  const submarineSourceChoice = material => {
    const uid = String(material?.uid || '');
    if (submarineSourceCache.has(uid)) return submarineSourceCache.get(uid);
    const options = submarineSourceOptions(material), fallbackKind = staticSubmarineKind(material), valid = options.filter(option => Number(option.price) > 0);
    valid.sort((left, right) => Number(left.price) - Number(right.price) || (left.kind === fallbackKind ? -1 : 1));
    const choice = valid[0] || { key: 'pending', kind: fallbackKind, label: '待补价', source: '未获取有效价格', price: 0, unavailable: true };
    const result = { ...choice, fallbackKind, options };
    submarineSourceCache.set(uid, result);
    return result;
  };
  const submarinePartIds = () => new Set((submarineData.parts || []).map(part => String(part.id)));
  // 推荐材料只列出原材料及仍有外部取得方式的半成品；纯自制半成品会在制作配方中展开，
  // 不占用材料指导价列表。部件本身不属于推荐材料的半成品。
  const isSubmarineIntermediate = material => {
    const uid = String(material?.uid || '');
    return Boolean(uid && !submarinePartIds().has(uid) && graphRecipes[uid]?.length);
  };
  const hasSubmarineExchangeRoute = material => exchangeRoutesFor(material?.uid).length > 0;
  const showSubmarineGuideMaterial = material => {
    if (!isSubmarineIntermediate(material)) return true;
    const choice = submarineSourceChoice(material);
    return choice.key !== 'craft' || hasSubmarineExchangeRoute(material);
  };
  const submarineGuideKind = material => {
    const choice = submarineSourceChoice(material);
    return isSubmarineIntermediate(material) && choice.label === '市场采购'
      ? '市场采购半成品'
      : choice.kind;
  };
  const showSubmarineRecommendationTag = material => {
    const choice = submarineSourceChoice(material);
    // 无制作配方的原材料推荐市场采购时，价格列已足够表达取得方式，无需重复标签。
    return Boolean(isSubmarineIntermediate(material) || choice.label !== '市场采购');
  };
  const recommendedNpcMaterial = material => submarineSourceChoice(material).kind === 'NPC 购买材料';
  const hasComparableSubmarineSources = material => submarineSourceChoice(material).options.filter(option => Number(option.price) > 0).length >= 2;
  const selfCraftLeafIds = (uid, leaves = new Set(), trail = new Set()) => {
    uid = String(uid); if (trail.has(uid)) return leaves;
    const node = (graphRecipes[uid] || [])[0];
    if (!node) { leaves.add(uid); return leaves; }
    const next = new Set(trail); next.add(uid);
    for (let index = 0; index < node.a.length; index += 2) { const child = Number(node.a[index]); if (child > 0) selfCraftLeafIds(child, leaves, next); }
    return leaves;
  };
  const npcComparison = uid => {
    uid = String(uid);
    if (npcComparisonCache.has(uid)) return npcComparisonCache.get(uid);
    const candidate = npcCandidate(uid);
    if (!candidate) return null;
    const manual = Boolean(candidate.manual), hasCraftRoute = Boolean(graphRecipes[uid]?.length);
    // NPC 直购基础材料没有自制配方。递归成本计算仍可将其作为固定价叶子，
    // 但材料列表和详情不能把该固定价误称为“自制价格”。
    const self = hasCraftRoute ? selfCraftUnitCost(uid) : null;
    // 不可自制的基础材料无需等待市场价：NPC 直购就是其固定成本。
    const recommendation = manual || candidate.force || !hasCraftRoute || self == null || candidate.price <= self ? 'NPC' : '自制';
    const value = { ...candidate, uid, self, hasCraftRoute, recommendation, difference: self == null ? null : candidate.price - self };
    npcComparisonCache.set(uid, value);
    return value;
  };
  npcComparisonReady = true;
  invalidateNpcMaterials();
  ensureSubmarineMaterials();
  syncPurchaseCosts();
  const refreshNpcRecommendations = () => { invalidateNpcMaterials(); ensureSubmarineMaterials(); syncPurchaseCosts(); };
  const recipeNodeFor = (uid, parentJob = null, scope = 'equipment') => {
    const candidates = graphRecipes[String(uid)] || [];
    const node = candidates.find(row => parentJob != null && Number(row.j) === Number(parentJob)) || candidates[0] || null;
    const material = data.m.find(item => String(item.uid) === String(uid));
    const direct = scope === 'submarine' ? submarineSourceChoice(material || { uid: String(uid) }) : directSourceChoice(material || { uid: String(uid) });
    const recipeCost = node ? (scope === 'submarine' ? selfCraftUnitCost(uid) : equipmentCraftUnitCost(uid)) : null;
    // 直购、采购或兑换成本不高于递归制作时，将该材料作为基础叶子处理。
    // 潜水艇的“自制（制作配方）”推荐不等于外购：必须继续展开合建与下级配方。
    // 只有市场、NPC、兑换等非制作渠道才可以将该物品视为成本叶子。
    const isSelfCraftChoice = scope === 'submarine' && direct.key === 'craft';
    if (!isSelfCraftChoice && direct.price > 0 && (!node || recipeCost == null || direct.price <= recipeCost)) return null;
    return node;
  };
  const materialName = uid => data.m.find(item => String(item.uid) === String(uid))?.n || baseMaterials.n?.[String(uid)] || submarineData.n?.[String(uid)] || `未知材料 ${uid}`;
  const nodeKey = (uid, node) => node ? `${uid}@${node.id || node.j}` : `leaf@${uid}`;
  // 统一生产计划：同一半成品先合并需求，再按产出向上取整；每个视图都从该计划取数。
  function calculateProductionPlan(bundle) {
    const nodes = new Map(), leaves = new Map(), roots = [];
    const scope = bundle.partId ? 'submarine' : 'equipment';
    const addLeaf = (uid, quantity) => leaves.set(String(uid), (leaves.get(String(uid)) || 0) + quantity);
    const addNeed = (uid, quantity, parentJob = null) => {
      const node = recipeNodeFor(uid, parentJob, scope);
      if (!node) { addLeaf(uid, quantity); return `leaf@${uid}`; }
      const key = nodeKey(uid, node);
      const entry = nodes.get(key) || { key, uid: Number(uid), node, needed: 0, batches: 0, processed: 0, inputs: [] };
      entry.needed += quantity;
      nodes.set(key, entry);
      return key;
    };
    bundle.components.filter(component => component.item).forEach(component => {
      const itemId = component.item.itemId;
      const key = addNeed(itemId, component.qty, baseMaterials.j?.[String(itemId)] ?? null);
      roots.push({ key, uid: Number(itemId), quantity: component.qty, name: component.item.n });
    });
    // 新增需求只补充因新批次产生的子素材，直到所有批次数稳定。
    let changed = true;
    while (changed) {
      changed = false;
      for (const entry of [...nodes.values()]) {
        const batches = Math.ceil(entry.needed / Math.max(1, Number(entry.node.y) || 1));
        const delta = batches - entry.processed;
        if (delta <= 0) continue;
        entry.processed = batches; entry.batches = batches; changed = true;
        for (let index = 0; index < entry.node.a.length; index += 2) {
          const uid = Number(entry.node.a[index]), quantity = Number(entry.node.a[index + 1] || 0) * delta;
          if (!uid || !quantity) continue;
          const childKey = addNeed(uid, quantity, entry.node.j);
          const input = entry.inputs.find(value => value.key === childKey);
          if (input) input.quantity += quantity;
          else entry.inputs.push({ key: childKey, uid, quantity });
        }
      }
    }
    const leafCost = uid => {
      const material = data.m.find(item => String(item.uid) === String(uid));
      return scope === 'submarine' ? submarineSourceChoice(material).price : materialUnitPrice(material);
    };
    const addAllocation = (target, key, quantity, trail = new Set()) => {
      if (trail.has(key) || !quantity) return;
      const entry = nodes.get(key);
      if (!entry) {
        const uid = Number(String(key).replace('leaf@', ''));
        target.cost += leafCost(uid) * quantity;
        return;
      }
      const share = quantity / Math.max(entry.needed, 1);
      const next = new Set(trail); next.add(key);
      entry.inputs.forEach(input => addAllocation(target, input.key, input.quantity * share, next));
    };
    const makeRows = (requests, nameFor) => {
      const map = new Map();
      requests.forEach((request, index) => {
        const allocation = { cost: 0 };
        addAllocation(allocation, request.key, request.quantity);
        const key = String(request.uid);
        const row = map.get(key) || { uid: Number(request.uid), name: nameFor(request), quantity: 0, cost: 0 };
        row.quantity += request.quantity; row.cost += allocation.cost; map.set(key, row);
      });
      return [...map.values()].sort((left, right) => left.uid - right.uid);
    };
    const finished = makeRows(roots, request => request.name);
    const directRequests = [];
    roots.forEach(root => {
      const entry = nodes.get(root.key);
      if (!entry) return;
      const share = root.quantity / Math.max(entry.needed, 1);
      entry.inputs.forEach(input => directRequests.push({ ...input, quantity: input.quantity * share, name: materialName(input.uid) }));
    });
    const direct = makeRows(directRequests, request => request.name);
    const basic = [...leaves.entries()].map(([uid, quantity]) => ({ uid: Number(uid), name: materialName(uid), quantity, cost: leafCost(uid) * quantity })).sort((left, right) => left.uid - right.uid);
    const total = basic.reduce((sum, row) => sum + row.cost, 0);
    const allocationCost = (key, quantity) => { const target = { cost: 0 }; addAllocation(target, key, quantity); return target.cost; };
    return { roots, nodes, finished, direct, basic, total, allocationCost, missing: basic.filter(row => !leafCost(row.uid)).map(row => row.name) };
  }
  const productionPlan = bundle => {
    const key = bundle.id || JSON.stringify(bundle.components?.map(component => [component.itemId || component.item?.itemId, component.qty]));
    if (!planCache.has(key)) planCache.set(key, calculateProductionPlan(bundle));
    return planCache.get(key);
  };
  // 台账成本价始终是当前整套“基础制作素材”生产计划成本，不提供人工成本覆盖。
  const unitCost = tableRow => productionPlan(tableRow).total;
  const baseIngredients = item => {
    const recipeMaterials = baseMaterials.b?.[String(item.itemId)];
    // 打包数据以紧凑的 [物品ID, 数量, ...] 形式保存，旧配方则仍使用名称/数量对。
    const pairs = recipeMaterials
      ? (Array.isArray(recipeMaterials[0])
        ? recipeMaterials
        : recipeMaterials.filter((_, index) => index % 2 === 0).map((uid, index) => [uid, recipeMaterials[index * 2 + 1]]))
      : (item.a || []).map(([name, qty]) => {
        const material = data.m.find(row => row.n === name);
        return [Number(material?.uid || 0), qty];
      });
    return pairs.map(([uid, qty]) => {
    const material = data.m.find(row => String(row.uid) === String(uid));
    return { material, qty };
    });
  };
  const directIngredients = item => {
    const directMaterials = baseMaterials.d?.[String(item.itemId)];
    const pairs = directMaterials
      ? directMaterials.filter((_, index) => index % 2 === 0).map((uid, index) => [uid, directMaterials[index * 2 + 1]])
      : (item.a || []).map(([name, qty]) => [data.m.find(row => row.n === name)?.uid, qty]);
    return pairs.map(([uid, qty]) => ({ material: data.m.find(row => String(row.uid) === String(uid)), uid, qty }));
  };
  const hasCompleteBaseRecipe = item => Boolean(recipeNodeFor(item.itemId)) && !baseMaterialMeta.cycles?.includes(String(item.itemId));
  const estimateRecipe = item => baseIngredients(item).reduce((sum, { material, qty }) => {
    return sum + qty * (material?.c || material?.mp || 0);
  }, 0);
  const inventory = tableRow => tableRow.components.length ? Math.min(...tableRow.components.filter(component => component.item).map(component => Math.floor(stock(component.item.id).q / component.qty))) : 0;
  const totalMade = tableRow => tableRow.components.length ? Math.min(...tableRow.components.filter(component => component.item).map(component => Math.floor((stock(component.item.id).made || 0) / component.qty))) : 0;
  const totalSold = tableRow => tableRow.components.length ? Math.min(...tableRow.components.filter(component => component.item).map(component => Math.floor((stock(component.item.id).sold || 0) / component.qty))) : 0;
  const priceFor = tableRow => tableRow.pricePart === 'gear'
    ? (prices[tableRow.priceKey] ?? ((prices[tableRow.group+'-防具'] || 0) + (prices[tableRow.group+'-首饰'] || 0)))
    : (prices[tableRow.priceKey] || 0);
  const ledgerRows = type => tableRows(type).flatMap(item => item.header ? [] : [item, ...(item.tool ? [item.tool] : [])]);
  const isCraftLog = entry => entry.autoKind === 'craft' || entry.autoKind === 'legacy-craft';
  const automaticLogs = (kind, bundle) => {
    const row = typeof bundle === 'object' ? bundle : ['770', '750'].flatMap(ledgerRows).find(item => item.id === bundle);
    const bundleId = row?.id || bundle;
    return data.l.filter(entry => kind === 'craft'
      ? isCraftLog(entry) && (entry.bundleId === bundleId || (row && entry.legacyMigration && entry.recipeCosts?.some(cost => row.components.some(component => component.item?.id === cost.id))))
      : entry.autoKind === kind && entry.bundleId === bundleId);
  };

  document.body.innerHTML = `
    <style>
      *{box-sizing:border-box}body{margin:0;background:#eef4f6;color:#203545;font:14px "Microsoft YaHei",sans-serif}.app{display:grid;grid-template-columns:230px minmax(0,1fr);min-height:100vh}aside{background:#143752;color:#fff;padding:28px 16px}.brand{padding:0 10px 30px;color:#e5c369;font-size:22px;font-weight:700}nav{display:grid;gap:4px}nav button{width:100%;padding:12px;border:0;border-radius:7px;background:transparent;color:#cbdce3;text-align:left;font:inherit;cursor:pointer}nav button.active{background:#ffffff1e;color:#fff}.nav-group{display:grid;gap:4px}.subnav{display:none;gap:4px;padding-left:12px}.subnav.open{display:grid}.subnav button{padding-left:22px;font-size:13px}.nav-caret{float:right;opacity:.75}main{max-width:1600px;width:100%;margin:auto;padding:34px}.view{display:none}.view.active{display:block}.header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.sub,.meta{color:#71818c}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:22px 0}.card{background:#fff;border-radius:10px;padding:16px;box-shadow:0 5px 17px #16364b12}.metric b{display:block;color:#147889;font-size:21px;margin-top:5px}.metric.clickable{border:0;text-align:left;width:100%;font:inherit;cursor:pointer}.metric.clickable:hover{outline:2px solid #75b9c3}.btn{border:1px solid #187a8b;border-radius:7px;padding:8px 11px;background:#187a8b;color:#fff;font:inherit;cursor:pointer}.btn.secondary{background:#eff5f6;color:#176d79}.table-wrap{overflow:auto;background:#fff;border:1px solid #cbd6da;border-radius:10px;margin-top:20px}.ledger{border-collapse:collapse;min-width:950px;width:100%;font-family:"Microsoft YaHei",sans-serif}.ledger th{background:#f5f7f7;font-weight:700}.ledger th,.ledger td{border:1px solid #cbd6da;padding:8px;text-align:center;white-space:nowrap}.ledger td.label{text-align:left}.ledger tr.group-row td{background:#e8f1f3;color:#124c59;font-weight:700;text-align:left;padding:0}.group-toggle{display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:0;background:transparent;color:inherit;font:inherit;font-weight:700;text-align:left;cursor:pointer}.group-toggle b{margin-left:auto}.ledger tr.detail td.label{padding-left:28px;color:#23658a}.ledger td.price{color:#176d79;font-weight:700;cursor:pointer}.ledger td.profit{color:#0d7b65;font-weight:700}.ledger td.margin{color:#986b19}.bundle-link{display:inline-flex;align-items:center;gap:7px;border:0;background:transparent;padding:0;color:inherit;font:inherit;font-weight:700;cursor:pointer;text-align:left}.bundle-link:hover{color:#0b8191;text-decoration:underline}.job-badge{display:inline-grid;place-items:center;width:23px;height:23px;flex:0 0 23px;border-radius:50%;background:#dcecf0;font-size:12px;overflow:hidden}.job-badge img{display:block;width:100%;height:100%;object-fit:contain}.job-badge img+span{display:none}.spin-actions{display:inline-flex;border:1px solid #b7c9ce;border-radius:5px;overflow:hidden}.spin-actions button{width:25px;height:25px;border:0;background:#fff;color:#1b6d7d;cursor:pointer;font-size:16px;line-height:1}.spin-actions button+button{border-left:1px solid #b7c9ce}.spin-actions button:disabled{color:#b9c6ca;cursor:not-allowed}.tool-strip td{padding:7px 14px;background:#f7fbfc;text-align:left}.tool-chip{display:inline-flex;align-items:center;gap:10px;padding:7px 10px;border:1px solid #bed4d9;border-radius:8px;background:#fff;box-shadow:0 2px 6px #1231}.tool-chip .meta{font-size:12px}.tool-chip .spin-actions{margin-left:4px}.note{margin-top:12px;color:#71818c;font-size:12px}.empty{padding:24px;color:#71818c;text-align:center}.crystal-grid{display:grid;grid-template-columns:repeat(3,minmax(270px,1fr));gap:16px;margin-top:20px}.crystal-card{overflow:hidden;border:1px solid #d7e2e6;border-radius:12px;background:#fff;box-shadow:0 5px 17px #16364b12}.crystal-card h2{display:flex;align-items:center;gap:10px;margin:0;padding:13px 16px;background:linear-gradient(90deg,color-mix(in srgb,var(--element) 16%,white),#fff);font-size:16px;color:#244554}.crystal-icon{width:27px;height:32px;flex:0 0 auto;filter:drop-shadow(0 2px 2px #0003)}.crystal-table{width:100%;border-collapse:collapse}.crystal-table td{padding:11px 12px;border-top:1px solid #edf1f3;vertical-align:middle}.crystal-table td:nth-child(2),.crystal-table td:nth-child(3){text-align:right;font-variant-numeric:tabular-nums}.crystal-name{display:flex;align-items:center;gap:8px;font-weight:700}.crystal-tier{color:#71818c;font-size:12px}.crystal-price{color:#176d79;font-weight:700}.crystal-action{display:flex;justify-content:flex-end;padding:0 12px 12px}.status{margin-top:10px;color:#a0524d;font-size:12px}.material-category{margin-top:16px;background:#fff;border:1px solid #cbd6da;border-radius:10px;overflow:hidden}.material-category summary{display:flex;justify-content:space-between;padding:13px 16px;color:#244554;font-weight:700;cursor:pointer}.material-category summary span{font-size:12px;color:#71818c;font-weight:400}.material-category .table-wrap{margin:0;border:0;border-radius:0}dialog{border:0;border-radius:12px;min-width:330px;box-shadow:0 18px 60px #1238}.modal{padding:20px}.modal label{display:block;margin:10px 0}.modal input,.modal select{display:block;width:100%;margin-top:4px;padding:8px}#other-material-search{flex:1;min-width:180px;border:1px solid #b7c9ce;border-radius:7px;padding:8px;font:inherit}.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.price-form{min-width:390px}#bundle-detail-dialog{width:min(1540px,calc(100vw - 32px));max-width:none;max-height:94vh;padding:0;overflow:hidden}#bundle-detail-dialog::backdrop{background:#17374a88}.detail-modal{width:100%;max-height:94vh;overflow-y:auto;overflow-x:hidden;padding:26px}.detail-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:18px}.detail-column{min-width:0;border:1px solid #d6e1e4;border-radius:8px;overflow:hidden}.detail-column h3{margin:0;padding:11px 13px;background:#eff6f7;font-size:14px}.material-list{margin:0;padding:0;list-style:none}.material-list li{display:flex;justify-content:space-between;gap:12px;padding:8px 12px;border-top:1px solid #edf1f3;white-space:normal;overflow-wrap:anywhere}.detail-cost{margin-top:16px;padding:12px;background:#eaf5f2;color:#126653;font-weight:700;border-radius:7px}.sales-history{margin-top:20px;border-top:1px solid #d6e1e4;padding-top:18px}.history-head h3{margin:0 0 5px}.history-form{display:grid;grid-template-columns:1fr 100px 1fr auto;gap:10px;align-items:end;margin-top:12px}.history-form label{display:grid;gap:4px;color:#71818c;font-size:12px}.history-form input{min-width:0;padding:8px;border:1px solid #b7c9ce;border-radius:6px;font:inherit}.history-table .ledger{min-width:0}.history-table{margin-top:12px}.equipment-summaries{display:grid;grid-template-columns:repeat(2,minmax(320px,1fr));gap:18px;margin-top:22px}.profit-summary{background:#fff;border:1px solid #cbd6da;border-radius:10px;padding:16px}.profit-summary h2{font-size:16px;margin:0 0 12px;color:#244554}.profit-summary .ledger{min-width:0}.profit-summary .ledger td:last-child{color:#d34c45;font-weight:700}.op-actions{display:flex;justify-content:center;gap:5px}.op-btn{border:1px solid;border-radius:5px;padding:5px 7px;background:#fff;font:12px "Microsoft YaHei",sans-serif;cursor:pointer;white-space:nowrap}.op-btn.craft{border-color:#32966e;color:#18724f;background:#f2fbf6}.op-btn.sale{border-color:#267fa5;color:#126784;background:#eff9fd}.op-btn.undo{border-color:#c7d1d4;color:#61737b}.op-btn:disabled{opacity:.42;cursor:not-allowed}.section-toggle{margin-left:8px;border:1px solid #b8ccd2;border-radius:12px;background:#fff;color:#176d79;padding:2px 8px;font:12px "Microsoft YaHei",sans-serif;cursor:pointer}.tool-strip .tool-chip{width:100%;flex-wrap:wrap}.detail-column .ledger{min-width:0;font-size:13px}.detail-column .ledger th,.detail-column .ledger td{white-space:normal;padding:7px}.refreshing{opacity:.78;cursor:wait}.refreshing::before{content:"↻";display:inline-block;margin-right:5px;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1050px){.crystal-grid{grid-template-columns:repeat(2,minmax(270px,1fr))}}@media(max-width:800px){.app{grid-template-columns:1fr}aside{padding:16px}.brand{padding-bottom:14px}nav{display:flex;flex-wrap:wrap}.nav-group{flex:1;min-width:160px}.subnav{padding-left:8px}.cards{grid-template-columns:1fr 1fr}main{padding:20px}.crystal-grid,.detail-columns,.equipment-summaries{grid-template-columns:1fr}.history-form{grid-template-columns:1fr 1fr}.history-form button{grid-column:1/-1}}@media(max-width:520px){.cards{grid-template-columns:1fr}}
      #purchase-manager-dialog{width:min(1040px,calc(100vw - 32px));max-width:none;max-height:88vh;padding:0;overflow:hidden}#purchase-manager-dialog .modal{max-height:88vh;overflow:auto}.purchase-stats{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:12px;margin:18px 0}.purchase-stats .card{box-shadow:none;border:1px solid #d8e4e7}.exchange-category-panel{padding:0 16px 16px}.exchange-category-panel .table-wrap{margin-top:12px;border:1px solid #d9e3e6;border-radius:7px}.exchange-category-panel .ledger{min-width:640px}.other-layout{display:grid;grid-template-columns:minmax(260px,.38fr) minmax(420px,1fr);gap:16px;margin-top:20px}.other-search-card{margin:0!important;align-self:start}.other-added-card{margin:0!important;min-height:360px}.grade-selects{display:inline-flex;gap:10px;margin:16px 0 0 16px;vertical-align:top}.grade-selects label{display:inline-grid;gap:5px}.grade-selects select{padding:7px;border:1px solid #b7c9ce;border-radius:6px;background:#fff;font:inherit}.material-tag{display:inline-block;margin:2px;padding:2px 6px;border-radius:10px;background:#e5f2f4;color:#176d79;font-size:11px}.recommend-tag{display:inline-block;margin-right:5px;padding:2px 6px;border-radius:10px;font-size:11px;font-weight:700;border:1px solid transparent}.recommend-market{background:#e1f0fb;color:#17648b;border-color:#b6d9ee}.recommend-npc{background:#fff0df;color:#b8611b;border-color:#f1c58e}.recommend-lavender{background:#eee7fb;color:#6f4ba0;border-color:#d0bce9}.recommend-pepper{background:#edf5d8;color:#627c20;border-color:#cbdca2}.recommend-white-steel{background:#e7eff5;color:#486d88;border-color:#bdcedb}.recommend-yellow-brass{background:#f9efd8;color:#9a681b;border-color:#e3c77e}.recommend-craft{background:#e1f3f4;color:#16727a;border-color:#a9d8db}.recommend-pending{background:#edf0f1;color:#65747a;border-color:#d3dbde}.npc-tag{display:inline-block;margin-right:5px;padding:2px 6px;border-radius:10px;background:#fff0df;color:#b8611b;font-size:11px;font-weight:700}.npc-row td{background:#fff9f1;color:#874d1c}.detail-section td{background:#f1f6f7!important;color:#365767!important;font-weight:700;text-align:left}.detail-section.exchange-section td{background:#f0f4f7!important;color:#4d687c!important}.detail-columns.four{grid-template-columns:repeat(4,minmax(0,1fr))}.overview-chart{margin-top:22px;padding:18px}.overview-chart h2{margin:0;font-size:16px}.chart-legend{display:flex;gap:14px;margin:10px 0;color:#60737d;font-size:12px}.chart-key{display:inline-flex;align-items:center;gap:5px}.chart-key i{display:inline-block;width:10px;height:10px;border-radius:2px}.chart-key .revenue{background:#247ea0}.chart-key .profit{background:#35a274}.chart-svg{width:100%;height:auto;display:block;overflow:visible}.chart-axis{stroke:#c8d5d9;stroke-width:1}.chart-label{fill:#71818c;font-size:11px}@media(max-width:1150px){.detail-columns.four{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:800px){.other-layout{grid-template-columns:1fr}.other-added-card{min-height:0}.purchase-stats{grid-template-columns:1fr}.grade-selects{display:flex;margin-left:0;width:100%}.detail-columns.four{grid-template-columns:1fr}}
    </style>
    <div class="app"><aside><div class="brand">金蝶幻想</div><nav>
      <button data-page="home">◈ 总览</button>
      <div class="nav-group"><button id="equipment-toggle" aria-expanded="false">⚔ 装备售卖 <span class="nav-caret">⌄</span></button><div id="equipment-subnav" class="subnav"><button data-type="770">◦ 战职装备</button><button data-type="750">◦ 生产采集装备</button></div></div>
      <div class="nav-group"><button id="submarine-toggle" aria-expanded="false">◉ 潜水艇售卖 <span class="nav-caret">⌄</span></button><div id="submarine-subnav" class="subnav"><button data-submarine-view="ledger">◦ 潜水艇台账</button></div></div>
      <div class="nav-group"><button id="guide-toggle" aria-expanded="false">▦ 材料指导价 <span class="nav-caret">⌄</span></button><div id="guide-subnav" class="subnav"><button data-guide="crystals">◦ 水晶价格</button><button data-guide="basic">◦ 基础材料价格</button></div></div>
    </nav></aside><main>
      <section id="home" class="view"><h1>营业总览</h1><div class="sub">日、周、月、年装备与潜水艇销售流水、成本与净利润</div><div id="metrics" class="cards"></div><div id="overview-chart"></div></section>
      <section id="equipment" class="view"></section>
      <section id="submarine" class="view"></section>
      <section id="guide" class="view"></section>
    </main></div>
    <dialog id="custom-sale"><form id="custom-sale-form" class="modal"><h2>自定义成交价销售</h2><label>套装 / 分项<select id="custom-row"></select></label><label>成交单价<input id="custom-price" type="number" min="0"></label><button class="btn">保存销售</button></form></dialog>
    <dialog id="price-template-dialog"><form id="price-template-form" class="modal price-form"><h2 id="price-template-title">统一调整套装价格</h2><div class="sub">保存后会同步更新当前装备类型的所有职业组；之后仍可点击单行套装价进行单独覆盖。</div><label id="price-total-label">套装总价<input id="price-template-total" type="number" min="0" step="1"></label><label>防具价格<input id="price-template-armor" type="number" min="0" step="1"></label><label>首饰价格<input id="price-template-accessory" type="number" min="0" step="1"></label><label id="price-weapon-label">武器价格<input id="price-template-weapon" type="number" min="0" step="1"></label><div class="modal-actions"><button type="button" class="btn secondary" data-close="price-template-dialog">取消</button><button class="btn">保存统一价格</button></div></form></dialog>
    <dialog id="single-price-dialog"><form id="single-price-form" class="modal"><h2 id="single-price-title">调整套装价格</h2><label>套装价<input id="single-price-value" type="number" min="0" step="1"></label><div class="modal-actions"><button type="button" class="btn secondary" data-close="single-price-dialog">取消</button><button class="btn">保存</button></div></form></dialog>
    <dialog id="sales-history-dialog"><div class="modal price-form"><div class="header"><div><h2 id="sales-history-title">销售记录</h2><div class="sub">仅显示当前装备类型的逐笔装备成交。</div></div><button class="btn secondary" data-close="sales-history-dialog">关闭</button></div><div id="sales-history-content"></div></div></dialog>
    <dialog id="overview-sales-dialog"><div class="modal price-form"><div class="header"><div><h2 id="overview-sales-title">销售明细</h2><div class="sub">已完成装备销售的实际成交记录。</div></div><button class="btn secondary" data-close="overview-sales-dialog">关闭</button></div><div id="overview-sales-content"></div></div></dialog>
    <dialog id="auto-sale-dialog"><form id="auto-sale-form" class="modal"><h2>确认按套装价售卖</h2><div id="auto-sale-summary" class="card" style="box-shadow:none;background:#f3f8f9"></div><div class="modal-actions"><button type="button" class="btn secondary" data-close="auto-sale-dialog">取消</button><button class="btn">确认售卖</button></div></form></dialog>
    <dialog id="bundle-detail-dialog"><div class="detail-modal"><div class="header"><div><div id="bundle-detail-meta" class="meta"></div><h2 id="bundle-detail-title">装备详情</h2><div class="sub">成品仅作为清单显示；成本仅统计递归展开后的基础制作素材。</div></div><button class="btn secondary" data-close="bundle-detail-dialog">关闭</button></div><div id="bundle-detail-content"></div></div></dialog>
    <dialog id="recipe-reference-dialog"><div class="modal price-form"><div class="header"><div><div id="recipe-reference-meta" class="meta">潜水艇配方参考</div><h2 id="recipe-reference-title">制作配方</h2><div class="sub">此处仅核对官方配方结构，不参与当前市场 / 兑换成本核算。</div></div><button class="btn secondary" data-close="recipe-reference-dialog">关闭</button></div><div id="recipe-reference-content"></div></div></dialog>
    <dialog id="purchase-dialog"><form id="purchase-form" class="modal price-form"><h2 id="purchase-title">记录采购</h2><label>日期<input id="purchase-date" type="date"></label><div id="purchase-voucher-summary" class="card" style="box-shadow:none;background:#f3f8f9" hidden></div><label id="purchase-kind-label">采购方式<select id="purchase-kind"></select></label><div id="purchase-direct-fields"><label>购买数量<input id="purchase-quantity" type="number" min="0.01" step="0.01"></label><label>税率<select id="purchase-tax"><option value="0.05">5%</option><option value="0">0%</option></select></label><label>单价<input id="purchase-unit" type="number" min="0" step="0.01"></label><label>合价（含税）<input id="purchase-total" type="number" min="0" step="0.01"></label></div><div id="purchase-exchange-fields" hidden><div id="purchase-exchange-note" class="sub"></div><label>兑换次数<input id="purchase-exchange-turns" type="number" min="1" step="1"></label><label id="purchase-source-price-label">凭证单价<input id="purchase-source-price" type="number" min="0" step="0.01"></label><div id="purchase-exchange-summary" class="card" style="box-shadow:none;background:#f3f8f9"></div></div><div class="modal-actions"><button class="btn">保存采购</button></div></form></dialog>
    <dialog id="purchase-manager-dialog"><div class="modal"><div class="header"><div><div id="purchase-manager-meta" class="meta">材料采购</div><h2 id="purchase-manager-title">采购价格</h2><div id="purchase-manager-average" class="sub"></div></div><div><button id="purchase-manager-add" class="btn">+ 记录采购</button> <button class="btn secondary" data-close="purchase-manager-dialog">关闭</button></div></div><div id="purchase-manager-content"></div></div></dialog>
    <dialog id="submarine-sale-dialog"><form id="submarine-sale-form" class="modal"><h2 id="submarine-sale-title">确认潜水艇部件售卖</h2><div id="submarine-sale-summary" class="card" style="box-shadow:none;background:#f3f8f9"></div><label>出售数量<input id="submarine-sale-quantity" type="number" min="1" step="1" value="1"></label><label>实际单价<input id="submarine-sale-price" type="number" min="0" step="1"></label><div class="modal-actions"><button type="button" class="btn secondary" data-close="submarine-sale-dialog">取消</button><button class="btn">确认售卖</button></div></form></dialog>
    <dialog id="submarine-suite-sale-dialog"><form id="submarine-suite-sale-form" class="modal"><h2 id="submarine-suite-sale-title">确认整套售卖</h2><div id="submarine-suite-sale-summary" class="card" style="box-shadow:none;background:#f3f8f9"></div><label>出售套数<input id="submarine-suite-sale-quantity" type="number" min="1" step="1" value="1"></label><label>实际单套成交价<input id="submarine-suite-sale-price" type="number" min="0" step="1"></label><div class="modal-actions"><button type="button" class="btn secondary" data-close="submarine-suite-sale-dialog">取消</button><button class="btn">确认整套售卖</button></div></form></dialog>
    <dialog id="submarine-craft-dialog"><form id="submarine-craft-form" class="modal"><h2 id="submarine-craft-title">制作入库</h2><div id="submarine-craft-summary" class="card" style="box-shadow:none;background:#f3f8f9"></div><label id="submarine-craft-quantity-label">制作数量<input id="submarine-craft-quantity" type="number" min="1" step="1" value="1"></label><div class="modal-actions"><button type="button" class="btn secondary" data-close="submarine-craft-dialog">取消</button><button class="btn">确认制作入库</button></div></form></dialog>
    <dialog id="submarine-suite-dialog"><form id="submarine-suite-form" class="modal price-form"><h2 id="submarine-suite-title">新增潜水艇整套</h2><label>套装简称（船体、船尾、船首、舰桥；0 表示不含）<input id="submarine-suite-code" pattern="[0-5]{4}" maxlength="4" placeholder="例如 3124"></label><label><input id="submarine-suite-modified" type="checkbox" style="display:inline;width:auto;margin-right:6px">使用改级部件</label><label>建议售价<input id="submarine-suite-price" type="number" min="0" step="1"></label><div class="modal-actions"><button type="button" class="btn secondary" data-close="submarine-suite-dialog">取消</button><button class="btn">保存套装</button></div></form></dialog>
    <dialog id="npc-material-dialog"><div class="modal price-form"><div class="header"><div><h2>管理 NPC 购买材料</h2><div class="sub">仅能添加潜水艇推荐材料名录中的材料；加入后会从其他潜水艇分类中排除。</div></div><button class="btn secondary" data-close="npc-material-dialog">关闭</button></div><div id="npc-material-list"></div><hr style="border:0;border-top:1px solid #d6e1e4;margin:18px 0"><h3>添加 NPC 购买材料</h3><label>搜索潜水艇推荐材料<input id="npc-material-search" placeholder="输入名称或物品 ID"></label><div id="npc-material-results"></div><form id="npc-material-form"><input id="npc-material-id" type="hidden"><input id="npc-material-name" type="hidden"><label>NPC 采购价<input id="npc-material-price" type="number" min="0" required></label><label>购买来源<input id="npc-material-source" placeholder="例如 NPC 名称或商店" required></label><div class="modal-actions"><button class="btn">加入 NPC 分类</button></div></form></div></dialog>
    <dialog id="report-reconcile-dialog"><form id="report-reconcile-form" class="modal price-form"><h2>补全销售记录来源</h2><div id="report-reconcile-summary" class="card" style="box-shadow:none;background:#f3f8f9"></div><label>销售日期<input id="report-reconcile-date" type="date" required></label><label>记录名称<input id="report-reconcile-item" required></label><label>销售额<input id="report-reconcile-amount" type="number" min="0" step="1" required></label><label>销售成本<input id="report-reconcile-cost" type="number" min="0" step="1" required></label><label>利润<input id="report-reconcile-profit" type="number" step="1" required></label><label>归属类型<select id="report-reconcile-kind"><option value="equipment">装备销售</option><option value="part">潜水艇单件</option><option value="suite">潜水艇整套</option></select></label><label>对应项目<select id="report-reconcile-target"></select></label><div class="modal-actions"><button type="button" class="btn secondary" data-close="report-reconcile-dialog">取消</button><button class="btn">保存归属</button></div></form></dialog>
  `;

  const reportFieldsValid = row => Boolean(row?.date && row?.item && Number.isFinite(Number(row.amount)) && Number.isFinite(Number(row.cost)) && Number.isFinite(Number(row.profit)));
  const reportSales = () => {
    const equipmentIds = new Set([...ledgerRows('770'), ...ledgerRows('750')].map(row => String(row.id)));
    const partIds = new Set((submarineData.parts || []).map(part => String(part.id)));
    const suiteIds = new Set(submarineSuites.map(suite => String(suite.id)));
    const make = (row, store, index, source, valid, reason) => ({ ...row, source: valid ? source : '待核对', sourceStatus: valid ? '已核对' : '待核对', reason: valid ? '' : reason, q: Number(row.q) || 1, reportKey: `${store}:${row.id || index}`, store, storeIndex: index });
    return [
      ...data.l.map((row, index) => ({ row, index })).filter(({ row }) => row.type === '出售').map(({ row, index }) => make(row, 'equipment', index, '装备销售', reportFieldsValid(row) && Boolean(row.bundleId) && equipmentIds.has(String(row.bundleId)), !row.bundleId ? '缺少装备分项标识' : !equipmentIds.has(String(row.bundleId)) ? '装备分项已不存在' : '销售字段不完整')),
      ...submarineSales.map((row, index) => make(row, 'part', index, '潜水艇单件', reportFieldsValid(row) && partIds.has(String(row.partId)), !row.partId ? '缺少潜水艇部件标识' : !partIds.has(String(row.partId)) ? '潜水艇部件已不存在' : '销售字段不完整')),
      ...submarineSuiteSales.map((row, index) => make(row, 'suite', index, '潜水艇整套', reportFieldsValid(row) && suiteIds.has(String(row.suiteId)), !row.suiteId ? '缺少潜水艇套装标识' : !suiteIds.has(String(row.suiteId)) ? '潜水艇套装已不存在' : '销售字段不完整'))
    ].sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')));
  };
  const findReportSale = key => reportSales().find(row => row.reportKey === key);

  function renderHome() {
    const all = reportSales(), day = today(), week = shiftDate(day, -6);
    const periods = [
      ['日', all.filter(row => row.date === day)],
      ['周', all.filter(row => row.date >= week && row.date <= day)],
      ['月', all.filter(row => row.date?.slice(0, 7) === day.slice(0, 7))],
      ['年', all.filter(row => row.date?.slice(0, 4) === day.slice(0, 4))]
    ];
    const sums = rows => rows.reduce((result, row) => ({
      amount: result.amount + (+row.amount || 0), cost: result.cost + (+row.cost || 0), profit: result.profit + (+row.profit || 0)
    }), { amount: 0, cost: 0, profit: 0 });
    document.querySelector('#metrics').innerHTML = periods.map(([name, rows]) => {
      const value = sums(rows);
      return `<button class="card metric clickable" data-overview-period="${name}"><small>${name}净利润 · 查看销售明细</small><b>${money(value.profit)}</b></button>`;
    }).join('');
    const categoryOf = row => {
      if (row.source === '潜水艇单件' || row.source === '潜水艇整套') return '潜水艇售卖';
      if (String(row.bundleId || '').startsWith('770-')) return '战职装备 770 HQ';
      if (String(row.bundleId || '').startsWith('750-')) return '生产采集装备 750 HQ';
      return '装备售卖';
    };
    const categories = [...new Set(all.map(categoryOf))];
    const activeCategories = categories.length ? categories : ['战职装备 770 HQ', '生产采集装备 750 HQ', '潜水艇售卖'];
    const colors = ['#247ea0', '#35a274', '#9a6fcd', '#df8c43', '#d35d66'];
    const days = Array.from({ length: 30 }, (_, index) => {
      const key = shiftDate(day, -29 + index), values = Object.fromEntries(activeCategories.map(category => [category, 0]));
      all.filter(entry => entry.date === key).forEach(entry => { values[categoryOf(entry)] = (values[categoryOf(entry)] || 0) + Number(entry.profit || 0); });
      return { key, values };
    });
    const figures = days.flatMap(entry => Object.values(entry.values)), minValue = Math.min(0, ...figures), maxValue = Math.max(1, ...figures);
    const width = 920, height = 300, left = 48, right = 16, top = 22, bottom = 42, plotHeight = height - top - bottom, plotWidth = width - left - right;
    const y = value => top + (maxValue - value) / Math.max(maxValue - minValue, 1) * plotHeight;
    const zero = y(0), slot = plotWidth / days.length, barWidth = Math.max(2, slot * .68 / activeCategories.length);
    const bars = days.map((entry, index) => {
      const x = left + index * slot + slot * .16, label = `${entry.key}\n${activeCategories.map(category => `${category}：${money(entry.values[category])}`).join('\n')}`;
      return `<g><title>${label}</title>${activeCategories.map((category, categoryIndex) => { const value = entry.values[category], valueY = y(value); return `<rect x="${x + categoryIndex * barWidth}" y="${Math.min(zero, valueY)}" width="${barWidth - .5}" height="${Math.abs(zero - valueY)}" fill="${colors[categoryIndex % colors.length]}" rx="1"/>`; }).join('')}${index % 5 === 0 || index === days.length - 1 ? `<text x="${x + slot * .32}" y="${height - 18}" text-anchor="middle" class="chart-label">${entry.key.slice(5)}</text>` : ''}</g>`;
    }).join('');
    document.querySelector('#overview-chart').innerHTML = `<section class="card overview-chart"><h2>近 30 天分类净利润</h2><div class="chart-legend">${activeCategories.map((category, index) => `<span class="chart-key"><i style="background:${colors[index % colors.length]}"></i>${category}</span>`).join('')}<span class="meta">装备品级按实际售卖记录自动识别</span></div><svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="近30天分类净利润柱状图"><line x1="${left}" y1="${zero}" x2="${width - right}" y2="${zero}" class="chart-axis"/><text x="4" y="${top + 4}" class="chart-label">${money(maxValue)}</text><text x="4" y="${zero + 4}" class="chart-label">0</text>${bars}</svg></section>`;
    document.querySelectorAll('[data-overview-period]').forEach(button => button.onclick = () => openOverviewSales(button.dataset.overviewPeriod));
  }

  const monthKey = date => String(date || '').slice(0, 7);
  const salesTotals = rows => rows.reduce((result, entry) => ({ amount: result.amount + (+entry.amount || 0), cost: result.cost + (+entry.cost || 0), profit: result.profit + (+entry.profit || 0) }), { amount: 0, cost: 0, profit: 0 });
  const salesTable = (rows, interactive = false) => {
    const totals = rows.reduce((result, entry) => ({ amount: result.amount + (+entry.amount || 0), cost: result.cost + (+entry.cost || 0), profit: result.profit + (+entry.profit || 0) }), { amount: 0, cost: 0, profit: 0 });
    return `<div class="table-wrap history-table"><table class="ledger"><thead><tr><th>日期</th><th>来源状态</th><th>装备 / 潜水艇</th><th>数量</th><th>销售额</th><th>销售成本</th><th>利润</th>${interactive ? '<th>追溯</th>' : ''}</tr></thead><tbody>${rows.map(entry => `<tr class="${entry.sourceStatus === '待核对' ? 'npc-row' : ''}"><td>${entry.date || '—'}</td><td><span class="material-tag">${entry.source || '待核对'}</span>${entry.reason ? `<small class="meta"> · ${entry.reason}</small>` : ''}</td><td class="label">${entry.item || '未命名销售'}</td><td>${entry.q || 1}</td><td>${money(entry.amount)}</td><td>${money(entry.cost)}</td><td class="profit">${money(entry.profit)}</td>${interactive ? `<td>${entry.sourceStatus === '待核对' ? `<button class="btn secondary" data-report-reconcile="${entry.reportKey}">补全来源</button> <button class="btn secondary" data-report-delete="${entry.reportKey}">删除</button>` : `<button class="btn secondary" data-report-view="${entry.reportKey}">查看原记录</button>`}</td>` : ''}</tr>`).join('') || `<tr><td colspan="${interactive ? 8 : 7}" class="empty">该期间暂无销售记录</td></tr>`}</tbody><tfoot><tr><th colspan="4">合计</th><th>${money(totals.amount)}</th><th>${money(totals.cost)}</th><th class="profit">${money(totals.profit)}</th>${interactive ? '<th></th>' : ''}</tr></tfoot></table></div>`;
  };
  function openOverviewSales(period, selectedMonth = '') {
    state.overviewPeriod = period; state.overviewSelectedMonth = selectedMonth;
    const day = today(), week = shiftDate(day, -6);
    const all = reportSales();
    const years = [...new Set(all.map(entry => String(entry.date || '').slice(0, 4)).filter(Boolean).concat(day.slice(0, 4)))].sort().reverse();
    const rows = period === '日' ? all.filter(entry => entry.date === day)
      : period === '周' ? all.filter(entry => entry.date >= week && entry.date <= day)
      : selectedMonth ? all.filter(entry => monthKey(entry.date) === selectedMonth) : [];
    document.querySelector('#overview-sales-title').textContent = selectedMonth ? `${selectedMonth} 销售流水明细` : period + '销售流水明细';
    if (period === '月' && !selectedMonth) {
      document.querySelector('#overview-sales-content').innerHTML = `<label>选择月份<input id="overview-month-picker" type="month" value="${day.slice(0, 7)}"></label><div class="modal-actions"><button id="open-month-detail" class="btn">查看该月明细</button></div>`;
      document.querySelector('#open-month-detail').onclick = () => openOverviewSales('月', document.querySelector('#overview-month-picker').value);
    } else if (period === '年' && !selectedMonth) {
      const defaultYear = state.overviewYear || day.slice(0, 4);
      const monthly = Array.from({ length: 12 }, (_, index) => `${defaultYear}-${String(index + 1).padStart(2, '0')}`).map(month => [month, all.filter(entry => monthKey(entry.date) === month)]);
      document.querySelector('#overview-sales-content').innerHTML = `<label>选择年份<select id="overview-year-picker">${years.map(year => `<option value="${year}" ${year === defaultYear ? 'selected' : ''}>${year} 年</option>`).join('')}</select></label><div class="table-wrap history-table"><table class="ledger"><thead><tr><th>月份</th><th>销售额</th><th>销售成本</th><th>利润</th><th></th></tr></thead><tbody>${monthly.map(([month, entries]) => { const total = salesTotals(entries); return `<tr><td>${month}</td><td>${money(total.amount)}</td><td>${money(total.cost)}</td><td class="profit">${money(total.profit)}</td><td><button class="btn secondary" data-year-month="${month}">查看明细</button></td></tr>`; }).join('')}</tbody></table></div>`;
      document.querySelector('#overview-year-picker').onchange = event => { state.overviewYear = event.target.value; openOverviewSales('年'); };
      document.querySelectorAll('[data-year-month]').forEach(button => button.onclick = () => openOverviewSales('年', button.dataset.yearMonth));
    } else {
      const pending = rows.filter(entry => entry.sourceStatus === '待核对');
      document.querySelector('#overview-sales-content').innerHTML = `${salesTable(rows, true)}${pending.length ? `<section class="sales-history"><h3>待核对销售记录</h3><div class="sub">这些记录仍计入总览；请补全来源或删除错误数据。</div>${salesTable(pending, true)}</section>` : ''}`;
      bindOverviewReportActions();
    }
    const dialog = document.querySelector('#overview-sales-dialog');
    if (!dialog.open) dialog.showModal();
  }
  function reportStore(entry) {
    return entry.store === 'equipment' ? data.l : entry.store === 'part' ? submarineSales : submarineSuiteSales;
  }
  function removeReportSale(entry) {
    const list = reportStore(entry), index = list.findIndex((row, rowIndex) => String(row.id || rowIndex) === entry.reportKey.split(':').slice(1).join(':'));
    if (index < 0) throw new Error('未找到原始销售记录。');
    list.splice(index, 1);
  }
  function openReportRecord(entry) {
    document.querySelector('#overview-sales-dialog').close();
    if (entry.store === 'equipment') {
      const bundle = [...ledgerRows('770'), ...ledgerRows('750')].find(row => String(row.id) === String(entry.bundleId));
      if (!bundle) return alert('对应装备分项已不存在，请先补全来源。');
      state.page = 'equipment'; state.type = String(bundle.id).startsWith('770-') ? '770' : '750'; state.expanded = true; render(); openBundleDetail(bundle);
    } else if (entry.store === 'part') {
      const part = submarineData.parts.find(item => String(item.id) === String(entry.partId));
      if (!part) return alert('对应潜水艇部件已不存在，请先补全来源。');
      state.page = 'submarine'; state.submarineView = 'ledger'; state.submarineExpanded = true; render(); openSubmarineDetail(part);
    } else {
      const suite = submarineSuites.find(item => String(item.id) === String(entry.suiteId));
      if (!suite) return alert('对应潜水艇套装已不存在，请先补全来源。');
      state.page = 'submarine'; state.submarineView = 'ledger'; state.submarineExpanded = true; render(); openSubmarineSuiteDetail(suite);
    }
  }
  function reconcileOptions(kind) {
    if (kind === 'equipment') return [...ledgerRows('770'), ...ledgerRows('750')].map(row => ({ id: row.id, label: `${row.group} · ${row.label}` }));
    if (kind === 'part') return submarineData.parts.map(part => ({ id: part.id, label: part.n }));
    return submarineSuites.map(suite => ({ id: suite.id, label: suiteLabel(suite) }));
  }
  function updateReconcileTargets() {
    const kind = document.querySelector('#report-reconcile-kind').value, select = document.querySelector('#report-reconcile-target'), options = reconcileOptions(kind);
    select.innerHTML = options.map(option => `<option value="${option.id}">${option.label}</option>`).join('');
  }
  function openReportReconcile(entry) {
    state.pendingReportKey = entry.reportKey;
    document.querySelector('#report-reconcile-summary').innerHTML = `<b>${entry.item || '未命名销售'}</b><div class="meta" style="margin-top:8px">${entry.date || '未填写日期'} · 销售额 ${money(entry.amount)} · 成本 ${money(entry.cost)} · ${entry.reason}</div>`;
    document.querySelector('#report-reconcile-date').value = entry.date || today();
    document.querySelector('#report-reconcile-item').value = entry.item || '';
    document.querySelector('#report-reconcile-amount').value = Number(entry.amount || 0);
    document.querySelector('#report-reconcile-cost').value = Number(entry.cost || 0);
    document.querySelector('#report-reconcile-profit').value = Number(entry.profit || 0);
    document.querySelector('#report-reconcile-kind').value = 'equipment';
    updateReconcileTargets();
    document.querySelector('#report-reconcile-dialog').showModal();
  }
  function reconcileReportSale(entry, kind, targetId, patch = {}) {
    const raw = { ...entry, ...patch };
    ['source', 'sourceStatus', 'reason', 'reportKey', 'store', 'storeIndex'].forEach(key => delete raw[key]);
    removeReportSale(entry);
    if (kind === 'equipment') {
      const bundle = reconcileOptions(kind).find(option => String(option.id) === String(targetId));
      if (!bundle) throw new Error('未找到选择的装备分项。');
      data.l.unshift({ ...raw, type: '出售', bundleId: bundle.id, autoKind: 'reconciled-sale' });
    } else if (kind === 'part') {
      const part = submarineData.parts.find(item => String(item.id) === String(targetId));
      if (!part) throw new Error('未找到选择的潜水艇部件。');
      submarineSales.unshift({ ...raw, partId: part.id, item: part.n });
    } else {
      const suite = submarineSuites.find(item => String(item.id) === String(targetId));
      if (!suite) throw new Error('未找到选择的潜水艇套装。');
      submarineSuiteSales.unshift({ ...raw, suiteId: suite.id, item: '潜水艇整套 ' + suiteLabel(suite) });
    }
  }
  function bindOverviewReportActions() {
    document.querySelectorAll('[data-report-view]').forEach(button => button.onclick = () => {
      const entry = findReportSale(button.dataset.reportView); if (entry) openReportRecord(entry);
    });
    document.querySelectorAll('[data-report-reconcile]').forEach(button => button.onclick = () => {
      const entry = findReportSale(button.dataset.reportReconcile); if (entry) openReportReconcile(entry);
    });
    document.querySelectorAll('[data-report-delete]').forEach(button => button.onclick = () => {
      const entry = findReportSale(button.dataset.reportDelete); if (!entry || !confirm('删除这条待核对销售记录？此操作会影响总览统计。')) return;
      try { removeReportSale(entry); save(); openOverviewSales(state.overviewPeriod, state.overviewSelectedMonth); renderHome(); } catch (error) { alert(error.message || '删除失败。'); }
    });
  }

  const guideMaterials = () => {
    if (state.guideView === 'crystals') return data.m.filter(isCrystal);
    if (state.basicCategory === 'equipment') return equipmentBaseMaterials();
    if (state.basicCategory === 'submarine') return submarineBaseMaterials().filter(showSubmarineGuideMaterial);
    return data.m.filter(material => otherMaterialIds.includes(String(material.uid)));
  };
  const equipmentBaseMaterials = () => {
    const cacheKey = [state.equipmentCombatTier, state.equipmentGatheringTier].join('|');
    const cached = guideIndexCache.equipment.get(cacheKey);
    if (cached) return data.m.filter(material => cached.has(String(material.uid)));
    const required = new Set();
    const activeTypes = new Set([state.equipmentCombatTier, state.equipmentGatheringTier].filter(Boolean));
    data.r.filter(item => activeTypes.has(item.t)).forEach(item => {
      baseIngredients(item).forEach(({ material }) => { if (material && !isCrystal(material)) required.add(String(material.uid)); });
    });
    guideIndexCache.equipment.set(cacheKey, required);
    return data.m.filter(material => required.has(String(material.uid))).sort((left, right) => Number(left.uid) - Number(right.uid));
  };
  const submarineCatalogIds = () => {
    if (guideIndexCache.catalog) return guideIndexCache.catalog;
    const ids = new Set(), visiting = new Set();
    const visit = uid => {
      uid = String(uid); if (visiting.has(uid)) return;
      visiting.add(uid);
      const node = (graphRecipes[uid] || [])[0];
      if (node) for (let index = 0; index < node.a.length; index += 2) { const child = Number(node.a[index]); if (child > 0) { ids.add(String(child)); visit(child); } }
      visiting.delete(uid);
    };
    (submarineData.parts || []).forEach(part => visit(part.id));
    guideIndexCache.catalog = ids;
    return ids;
  };
  const equipmentCatalogIds = () => {
    const ids = new Set();
    Object.values(baseMaterials.b || {}).forEach(inputs => {
      for (let index = 0; index < inputs.length; index += 2) {
        const uid = Number(inputs[index]); if (uid > 0) ids.add(String(uid));
      }
    });
    return ids;
  };
  // 索引声明超出实际配方范围时只记录待维护项，绝不据此扩充推荐材料目录。
  const sourceScopeAudit = () => {
    const equipment = equipmentCatalogIds(), submarine = submarineCatalogIds(), warnings = [];
    Object.entries(materialSources).forEach(([uid, source]) => {
      if (source.equipmentKinds?.length && !equipment.has(String(uid))) warnings.push({ uid: String(uid), name: source.name, scope: 'equipment' });
      if ((source.submarineKinds?.length || source.npc) && !submarine.has(String(uid))) warnings.push({ uid: String(uid), name: source.name, scope: 'submarine' });
    });
    return warnings;
  };
  const materialSourceAudit = sourceScopeAudit();
  window.FF14_MATERIAL_SOURCE_AUDIT = materialSourceAudit;
  if (materialSourceAudit.length) console.warn('材料来源索引存在未被配方引用的待维护项：', materialSourceAudit);
  const submarineBaseMaterials = () => {
    const cached = guideIndexCache.submarine;
    if (cached) return data.m.filter(material => cached.has(String(material.uid)) && !isCrystal(material)).sort((left, right) => Number(left.uid) - Number(right.uid));
    const parts = new Set((submarineData.parts || []).map(part => String(part.id)));
    const required = new Set([...submarineCatalogIds()].filter(uid => {
      if (parts.has(String(uid))) return false;
      const material = data.m.find(item => String(item.uid) === String(uid));
      const isMarketableIntermediate = Boolean(
        material && graphRecipes[String(uid)]?.length &&
        (Number(material.mp || 0) > 0 || directPurchaseAverage(material) > 0)
      );
      // 配方叶子、已有来源分类的半成品，以及实际被潜水艇配方使用且可市场采购的半成品均可进入推荐名录。
      // 不能遍历全部来源索引，否则会把装备专用材料错误加入潜水艇。
      return Boolean(npcCandidate(uid) || materialSources[String(uid)]?.submarineKinds?.length || !recipeNodeFor(uid) || isMarketableIntermediate);
    }));
    // 薰衣草与风茄虽不是船体配方的叶子材料，却是兑换采购的必要凭证。
    // 将它们纳入同一名录，用户可从材料行记录当次凭证价格。
    voucherCarrierIds.forEach(uid => required.add(String(uid)));
    guideIndexCache.submarine = required;
    return data.m.filter(material => required.has(String(material.uid)) && !isCrystal(material)).sort((left, right) => Number(left.uid) - Number(right.uid));
  };
  const submarineNpcMaterials = () => Object.values(npcMaterialByUid())
    .map(spec => data.m.find(material => String(material.uid) === spec.uid))
    .filter(material => material && recommendedNpcMaterial(material))
    .sort((left, right) => Number(left.uid) - Number(right.uid));
  const submarineNpcComparisons = () => Object.values(npcMaterialByUid()).map(spec => npcComparison(spec.uid)).filter(Boolean).sort((left, right) => Number(left.uid) - Number(right.uid));
  const materialMembership = material => {
    const uid = String(material.uid), cached = guideIndexCache.membership.get(uid);
    if (cached) return cached;
    const labels = [];
    if (equipmentBaseMaterials().some(item => String(item.uid) === String(material.uid))) labels.push('装备推荐材料');
    if (submarineBaseMaterials().some(item => String(item.uid) === String(material.uid)) || npcCandidate(material)) labels.push('潜水艇推荐材料');
    guideIndexCache.membership.set(uid, labels);
    return labels;
  };
  const sourceKinds = (material, scope) => {
    const source = materialSources[String(material.uid)] || {};
    return scope === 'equipment' ? source.equipmentKinds || [] : source.submarineKinds || [];
  };
  // 分类由同步后的基础素材索引明确给出；旧数据或外部新增材料才回退到常规采集品。
  const basicKind = material => sourceKinds(material, 'equipment').includes('怪物掉落') ? '怪物掉落' : baseMaterials.k?.[String(material.uid)] || '常规采集品';
  // 潜水艇推荐材料按业务约定的单一主分类显示；同一物品的其它获取途径保留为备注。
  const submarineKindPriority = ['NPC 购买材料', '常规采集品', '军票兑换', '薰衣草/风茄兑换', '天穹票兑换', '限时采集品', '怪物掉落', '潜水艇携带材料'];
  const submarineKind = material => {
    return submarineSourceChoice(material).kind;
  };
  const submarineSourceStatus = material => npcCandidate(material) || sourceKinds(material, 'submarine').length || baseMaterials.k?.[String(material.uid)] ? '已确认来源' : '待确认来源';
  const otherSearchResults = query => {
    const value = String(query || '').trim().toLowerCase();
    if (!value) return [];
    const current = data.m.filter(material => String(material.uid).includes(value) || material.n.toLowerCase().includes(value));
    const indexed = itemIndex()
      .filter(([uid, name]) => String(uid).includes(value) || String(name).toLowerCase().includes(value))
      .slice(0, 100)
      .map(([uid, n]) => data.m.find(material => String(material.uid) === String(uid)) || { id: 'other-' + uid, uid: String(uid), n, c: 0, mp: 0, u: '' });
    return [...new Map([...current, ...indexed].map(material => [String(material.uid), material])).values()];
  };
  const addOtherMaterial = async material => {
    if (!data.m.some(row => String(row.uid) === String(material.uid))) data.m.push(material);
    if (!otherMaterialIds.includes(String(material.uid))) otherMaterialIds.push(String(material.uid));
    invalidateGuideIndexes();
    save();
    await refreshMarket(false, [data.m.find(row => String(row.uid) === String(material.uid))]);
  };
  async function refreshMarket(manual = false, requestedMaterials = null) {
    // NPC 材料也保留市场快照，才能在来源比价中与市场采购公平比较。
    const materials = (requestedMaterials || data.m).filter(material => material?.uid && !material.exchangeTicket);
    if (!materials.length) return;
    if (window.materialRefreshRunning) return;
    window.materialRefreshRunning = true;
    state.marketRefreshing = true;
    const refreshPage = state.page, refreshView = state.guideView;
    if (state.page === 'guide' && state.guideView !== 'detail') renderGuide();
    try {
      const failed = [];
      const unavailable = [];
      const withoutSaleAverage = [];
      for (let index = 0; index < materials.length; index += 100) {
        const batch = materials.slice(index, index + 100);
        try {
          const response = await fetch('https://universalis.app/api/v2/aggregated/China/' + batch.map(item => item.uid).join(','));
          if (!response.ok) throw new Error('市场价格获取失败。');
          const body = await response.json();
          const results = Array.isArray(body.results) ? body.results : Object.values(body.results || {});
          const resultById = new Map(results.map(item => [String(item.itemId), item]));
          const refreshedAt = new Date().toLocaleString('zh-CN');
          batch.forEach(material => {
            const info = resultById.get(String(material.uid));
            const value = Number(info?.nq?.averageSalePrice?.region?.price);
            if (!info) {
              material.marketStatus = 'not-found';
              unavailable.push(material.uid);
            } else if (Number.isFinite(value) && value > 0) {
              material.mp = value;
              material.u = refreshedAt;
              delete material.marketStatus;
            } else {
              withoutSaleAverage.push(material);
            }
          });
          failed.push(...(body.failedItems || []).map(String));
        } catch (error) {
          failed.push(...batch.map(material => String(material.uid)));
        }
        if (index + 100 < materials.length) await new Promise(resolve => setTimeout(resolve, 80));
      }
      // 聚合接口的成交均价只统计近四日成交。没有成交时再查询当前 NQ 挂单均价，
      // 作为材料指导价与成本估算的兜底，而不是使用最低挂单价。
      for (let index = 0; index < withoutSaleAverage.length; index += 100) {
        const batch = withoutSaleAverage.slice(index, index + 100);
        const refreshedAt = new Date().toLocaleString('zh-CN');
        try {
          const response = await fetch('https://universalis.app/api/v2/China/' + batch.map(item => item.uid).join(',') + '?listings=20&entries=0&hq=false&fields=items.currentAveragePriceNQ');
          if (!response.ok) throw new Error('在售均价获取失败。');
          const body = await response.json(), items = body.items || {};
          batch.forEach(material => {
            const value = Number(items[String(material.uid)]?.currentAveragePriceNQ);
            if (Number.isFinite(value) && value > 0) {
              material.mp = value;
              material.u = refreshedAt;
              material.marketStatus = 'listing-average';
            } else {
              // 没有挂单时保留最近一次有效快照，避免刷新后价格被清零。
              material.marketStatus = Number(material.mp) > 0 ? 'stale' : 'no-average';
              if (!material.u) material.u = refreshedAt;
            }
          });
        } catch (error) {
          batch.forEach(material => {
            material.marketStatus = Number(material.mp) > 0 ? 'stale' : 'no-average';
            failed.push(String(material.uid));
          });
        }
        if (index + 100 < withoutSaleAverage.length) await new Promise(resolve => setTimeout(resolve, 80));
      }
      localStorage.setItem('ff14-market-refreshed-at', String(Date.now()));
      invalidateNpcMaterials();
      ensureSubmarineMaterials();
      syncPurchaseCosts();
      save();
      const notices = [];
      if (failed.length) notices.push(`刷新失败：${[...new Set(failed)].join('、')}，已保留原有快照`);
      if (unavailable.length) notices.push(`无市场数据：${[...new Set(unavailable)].join('、')}`);
      state.marketMessage = notices.join('；');
    } catch (error) {
      state.marketMessage = '市场价格刷新失败，已保留最近一次市场快照。';
      if (manual) alert('市场价格刷新失败，请稍后重试。');
    } finally {
      window.materialRefreshRunning = false;
      state.marketRefreshing = false;
      if (state.page === refreshPage && state.guideView === refreshView && state.page === 'guide' && state.guideView !== 'detail') renderGuide();
    }
  }
  function visibleGuideMarketMaterials() {
    if (state.guideView === 'crystals') return data.m.filter(material => isCrystal(material));
    if (state.guideView !== 'basic') return [];
    const materials = guideMaterials();
    if (state.basicCategory === 'other') return materials;
    const prefix = state.basicCategory + '-';
    const openKinds = Object.entries(state.guideCategories).filter(([key, open]) => open && key.startsWith(prefix)).map(([key]) => key.slice(prefix.length));
    const visible = !openKinds.length ? [] : materials.filter(material => {
      if (state.basicCategory !== 'submarine') return openKinds.includes(basicKind(material));
      return openKinds.includes(submarineGuideKind(material)) ||
        (state.guideCategories['submarine-npc'] && submarineGuideKind(material) === 'NPC 购买材料');
    });
    const carriers = state.basicCategory === 'submarine'
      ? Object.keys(exchangeSources.carriers || {}).map(uid => data.m.find(material => String(material.uid) === uid)).filter(Boolean)
      : [];
    return [...new Map([...visible, ...carriers].map(material => [String(material.uid), material])).values()];
  }
  function maybeRefreshMarket() {
    const last = Number(localStorage.getItem('ff14-market-refreshed-at') || 0);
    if (Date.now() - last < 3 * 60 * 60 * 1000 || state.marketRefreshTimer) return;
    state.marketRefreshTimer = setTimeout(() => {
      state.marketRefreshTimer = null;
      if (state.page === 'guide' && state.guideView !== 'detail') refreshMarket(false, visibleGuideMarketMaterials());
    }, 350);
  }
  const retainerInfo = materialOrUid => retainerData[String(typeof materialOrUid === 'object' ? materialOrUid?.uid : materialOrUid)];
  const retainerSummary = info => {
    const [ability, quantity] = info.quantities.at(-1) || [];
    const [level, minutes] = info.times.at(-1) || [];
    return `雇员：鉴别力 ${ability} · ${quantity}个 / ${level}级 · ${minutes}分钟`;
  };
  function decorateRetainerNotes(root) {
    const knownMaterials = [...data.m].sort((left, right) => right.n.length - left.n.length);
    root.querySelectorAll('table.ledger').forEach(table => {
      if (!table.tHead?.textContent.includes('市场平均价')) return;
      table.tBodies[0]?.querySelectorAll('tr').forEach(row => {
        const cell = row.querySelector('td.label');
        const material = cell && knownMaterials.find(item => cell.textContent.includes(item.n));
        const info = material && retainerInfo(material);
        if (!info || cell.querySelector('[data-retainer]')) return;
        const note = document.createElement('small');
        note.className = 'meta'; note.textContent = ' · ' + retainerSummary(info);
        const button = document.createElement('button');
        button.className = 'section-toggle'; button.dataset.retainer = material.uid; button.textContent = '雇员探险';
        cell.append(note, button);
      });
    });
  }
  function decorateSourceNotes(root) {
    if (state.basicCategory !== 'submarine') return;
    const knownMaterials = [...data.m].sort((left, right) => right.n.length - left.n.length);
    root.querySelectorAll('table.ledger').forEach(table => {
      if (!table.tHead?.textContent.includes('市场平均价')) return;
      table.tBodies[0]?.querySelectorAll('tr').forEach(row => {
        const material = knownMaterials.find(item => row.querySelector('td.label')?.textContent.includes(item.n));
        const choice = material && submarineSourceChoice(material);
        if (!choice?.options?.length || row.children[1]?.querySelector('.source-note')) return;
        const alternatives = [...new Set(choice.options.filter(option => option.key !== choice.key && Number(option.price) > 0).map(option => option.label))];
        if (!alternatives.length) return;
        const note = document.createElement('small');
        note.className = 'meta source-note'; note.textContent = ' · 可比价：' + alternatives.join('、');
        row.children[1].append(note);
      });
    });
  }
  function openRetainerDetail(uid) {
    const material = data.m.find(item => String(item.uid) === String(uid)), info = retainerInfo(uid);
    if (!material || !info) return;
    const quantityRows = info.quantities.map(([ability, quantity], index) => `<tr><td>${index ? '鉴别力' : '获得力'}</td><td>${ability}</td><td>${quantity} 个</td></tr>`).join('');
    const timeRows = info.times.map(([level, minutes]) => `<tr><td>${level} 级</td><td>${minutes} 分钟</td></tr>`).join('');
    document.querySelector('#bundle-detail-meta').textContent = '材料指导价 > 雇员探险';
    document.querySelector('#bundle-detail-title').textContent = material.n + '雇员探险';
    document.querySelector('#bundle-detail-content').innerHTML = `<div class="cards"><div class="card"><small>雇员职业</small><b>${info.job}</b></div><div class="card"><small>探险类型</small><b>${info.venture}</b></div></div><div class="detail-columns"><section class="detail-column"><h3>能力与筹集数量</h3><div class="note">第一项为获得力；后续档位为鉴别力。</div><div class="table-wrap history-table"><table class="ledger"><thead><tr><th>能力类型</th><th>所需能力</th><th>筹集数量</th></tr></thead><tbody>${quantityRows}</tbody></table></div></section><section class="detail-column"><h3>雇员等级与筹集时间</h3><div class="table-wrap history-table"><table class="ledger"><thead><tr><th>雇员等级</th><th>筹集时间</th></tr></thead><tbody>${timeRows}</tbody></table></div></section></div>`;
    if (!document.querySelector('#bundle-detail-dialog').open) document.querySelector('#bundle-detail-dialog').showModal();
  }
  function renderGuide() {
    const root = document.querySelector('#guide');
    if (state.guideView === 'detail') return renderPurchaseDetail();
    if (state.basicCategory === 'other') loadItemIndex();
    const crystals = state.guideView === 'crystals';
    const colors = { 火:'#df675c', 冰:'#62b9d7', 风:'#53ae72', 土:'#a98252', 雷:'#9672ce', 水:'#4a8bd8' };
    const icon = (element, tier) => `<svg class="crystal-icon" viewBox="0 0 32 38" aria-hidden="true"><path fill="${colors[element]}" d="M16 1 29 14 22 35H10L3 14Z"/><path fill="#fff8" d="m16 1 8 13-8 5z"/><path fill="#0002" d="m16 19 6 16H10z"/></svg>`;
    if (crystals) {
      const crystalCards = crystalSpecs.map(([element]) => {
        const list = data.m.filter(material => isCrystal(material) && material.n.startsWith(element + '之'));
        return `<article class="crystal-card" style="--element:${colors[element]}"><h2>${icon(element)}${element}属性水晶</h2><table class="crystal-table"><tbody>${list.map(material => `<tr><td><div class="crystal-name">${icon(element)}<span>${material.n}<small class="crystal-tier"> · ${material.n.replace(element + '之','')}</small></span></div></td><td><small class="crystal-tier">市场均价</small><br><span class="crystal-price">${marketPriceLabel(material)}</span></td><td><small class="crystal-tier">采购均价</small><br><b>${purchaseAverage(material) ? money(purchaseAverage(material)) : '未采购'}</b></td><td><button class="btn secondary" data-purchase="${material.id}">采购</button></td></tr>`).join('')}</tbody></table></article>`;
      }).join('');
      root.innerHTML = `<div class="header"><div><div class="meta">材料指导价 &gt; 水晶价格</div><h1>水晶价格</h1><div class="sub">市场平均价来自 Universalis 中国区；采购均价基于全部历史含税采购记录。</div></div><button id="refresh-market" class="btn${state.marketRefreshing ? ' refreshing' : ''}" ${state.marketRefreshing ? 'disabled' : ''}>${state.marketRefreshing ? '刷新中…' : '统一刷新市场价'}</button></div>${state.marketMessage ? '<div class="status">'+state.marketMessage+'</div>' : ''}<div class="crystal-grid">${crystalCards}</div>`;
      root.querySelector('#refresh-market').onclick = () => refreshMarket(true);
      root.querySelectorAll('[data-purchase]').forEach(button => button.onclick = () => { const material = data.m.find(item => item.id === button.dataset.purchase); if (material) openPurchaseManager(material); });
      maybeRefreshMarket();
      return;
    }
    const materials = guideMaterials();
    const membershipTags = material => materialMembership(material).map(label => `<span class="material-tag">${label}</span>`).join('') || '<span class="meta">未添加</span>';
    const materialTable = list => `<div class="table-wrap"><table class="ledger"><thead><tr><th>材料</th><th>分类</th><th>归属</th><th>市场平均价</th><th>采购平均价</th><th>最后刷新</th><th>采购价格</th></tr></thead><tbody>${list.map(material => {
      const submarine = state.basicCategory === 'submarine', choice = submarine ? submarineSourceChoice(material) : null;
      const kind = submarine ? submarineGuideKind(material) : basicKind(material), npc = submarine && choice.kind === 'NPC 购买材料' ? npcCandidate(material) : undefined;
      const recommendation = submarine && showSubmarineRecommendationTag(material) ? recommendationTag(choice) : '';
      const label = submarine && hasComparableSubmarineSources(material)
        ? `<button class="bundle-link" data-source-detail="${material.uid}">${recommendation}${material.n}</button>`
        : `${recommendation}${material.n}`;
      return `<tr class="${npc ? 'npc-row' : ''}"><td class="label">${label}</td><td>${kind}${submarine && choice.unavailable ? '<small class="meta"> · 待补价</small>' : ''}</td><td>${membershipTags(material)}</td><td>${marketPriceLabel(material)}</td><td>${purchaseAverage(material) ? money(purchaseAverage(material)) : '未采购'}</td><td>${material.u || '—'}</td><td><button class="btn secondary" data-purchase="${material.id}">采购价格</button></td></tr>`;
    }).join('') || '<tr><td colspan="7" class="empty">暂无材料</td></tr>'}</tbody></table></div>`;
    const npcTable = list => `<div class="table-wrap"><table class="ledger"><thead><tr><th>材料</th><th>NPC 售卖价</th><th>采购平均价</th><th>自制价</th><th>购买来源</th><th>记录采购</th></tr></thead><tbody>${list.map(material => { const spec = npcCandidate(material), comparison = npcComparison(material.uid), purchase = purchaseAverage(material), craftable = comparison?.hasCraftRoute, choice = submarineSourceChoice(material), recommendation = recommendationTag(choice); const label = hasComparableSubmarineSources(material) ? `<button class="bundle-link" data-source-detail="${material.uid}">${recommendation}${material.n}</button>` : `${recommendation}${material.n}`; return `<tr class="npc-row"><td class="label">${label}</td><td>${money(spec?.price)}</td><td>${purchase > 0 ? money(purchase) : '未采购'}</td><td>${craftable ? (comparison.self == null ? '等待市场价' : money(comparison.self)) : '—'}</td><td>${spec?.source || '—'}</td><td><button class="btn secondary" data-purchase="${material.id}">记录采购</button></td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">暂无 NPC 固定材料</td></tr>'}</tbody></table></div>`;
    const categoryTables = ['常规采集品', '限时采集品', '灵砂', '神典石材料', '怪物掉落'].map(kind => {
      const list = materials.filter(material => basicKind(material) === kind), key = 'equipment-' + kind;
      return `<details class="material-category" data-material-category="${key}" ${state.guideCategories[key] ? 'open' : ''}><summary>${kind}<span>${list.length} 项 · 点击展开</span></summary>${state.guideCategories[key] ? materialTable(list) : ''}</details>`;
    }).join('');
    const searchResults = otherSearchResults(state.otherSearch);
    const otherContent = `<div class="other-layout"><div class="card other-search-card"><div style="font-weight:700;margin-bottom:10px">搜索并加入其他材料</div><div class="sub">输入 Universalis 物品 ID 或中文名，例如：云杉原木 / 5395。</div><form id="other-material-form" style="display:flex;gap:8px;margin-top:12px"><input id="other-material-search" placeholder="材料 ID 或名称" value="${state.otherSearch}"><button class="btn">搜索</button></form>${state.otherSearch ? `<div class="table-wrap"><table class="ledger"><thead><tr><th>ID</th><th>材料</th><th>已归属</th><th>操作</th></tr></thead><tbody>${searchResults.map(material => { const stored = data.m.find(item => String(item.uid) === String(material.uid)) || { uid: material.uid, n: material.n }; const tags = membershipTags(stored); const joined = otherMaterialIds.includes(String(material.uid)); const used = materialMembership(stored).length; return `<tr><td>${material.uid}</td><td class="label">${material.n}</td><td>${tags}</td><td><button class="btn secondary" data-add-other="${material.uid}">${joined ? '已加入' : used ? '同时加入其他材料' : '加入'}</button></td></tr>`; }).join('') || `<tr><td colspan="4" class="empty">未找到相符道具，请确认名称或物品 ID。</td></tr>`}</tbody></table></div>` : ''}</div><div class="card other-added-card" style="padding:0"><div style="padding:12px 16px;font-weight:700;color:#244554">已加入的其他材料</div>${materials.length ? materialTable(materials) : '<div class="empty">尚未加入其他材料。可从左侧搜索结果中加入。</div>'}</div></div>`;
    const submarineKinds = ['市场采购半成品', '常规采集品', '军票兑换', '薰衣草/风茄兑换', '天穹票兑换', '限时采集品', '怪物掉落', '潜水艇携带材料'];
    const submarineTables = submarineKinds.map(kind => {
      const list = materials.filter(material => submarineGuideKind(material) === kind), key = 'submarine-' + kind;
      const ticketSettingsPanel = kind === '天穹票兑换' ? `<form id="ticket-unit-cost-form" class="exchange-category-panel"><div class="sub" style="margin-top:14px">用于后续白钢、黄铜兑换成本预估；历史采购记录保留各自填写的票价快照。</div><label style="display:inline-grid;gap:5px;margin-top:10px">默认天穹票价格（G / 张）<input id="ticket-unit-cost" type="number" min="0.01" step="0.01" value="${ticketUnitCost()}"></label><div class="modal-actions" style="justify-content:flex-start;margin-top:10px"><button class="btn">保存默认价格</button><button type="button" id="reset-ticket-unit-cost" class="btn secondary">恢复 80 G / 张</button></div></form>` : '';
      return `<details class="material-category" data-material-category="${key}" ${state.guideCategories[key] ? 'open' : ''}><summary>${kind}<span>${list.length} 项 · 点击展开</span></summary>${state.guideCategories[key] ? ticketSettingsPanel + materialTable(list) : ''}</details>`;
    }).join('');
    const npcCategoryKey = 'submarine-npc', npcOpen = state.guideCategories[npcCategoryKey] ?? true;
    const submarineContent = `<details class="material-category" data-material-category="${npcCategoryKey}" ${npcOpen ? 'open' : ''}><summary>NPC 购买材料<span>${submarineNpcMaterials().length} 项 · 固定价格</span></summary><div style="padding:0 16px 12px"><button id="manage-npc-materials" class="btn secondary">管理 NPC 材料</button></div>${npcTable(submarineNpcMaterials())}</details>${submarineTables}`;
    const basicContent = state.basicCategory === 'submarine'
      ? submarineContent
      : state.basicCategory === 'other' ? otherContent : categoryTables;
    const gradeSelects = state.basicCategory === 'equipment' ? `<div class="grade-selects"><label class="meta">战职装备品级<select id="combat-grade"><option value="770">770 HQ</option><option value="">无</option></select></label><label class="meta">生产采集装备品级<select id="gathering-grade"><option value="750">750 HQ</option><option value="">无</option></select></label></div>` : '';
    const basicSelect = `<label class="meta" style="display:inline-grid;gap:5px;margin-top:16px">材料范围<select id="basic-category"><option value="equipment">装备推荐材料</option><option value="submarine">潜水艇推荐材料</option><option value="other">其他材料</option></select></label>${gradeSelects}`;
    const coverage = baseMaterialMeta.coverage || {};
    const source = baseMaterialMeta.sources || {};
    const sourceNotice = `<div class="note">基础素材索引：770 ${coverage['770'] || 0}/77 · 750 ${coverage['750'] || 0}/39 · 非水晶基础材料 ${baseMaterialMeta.nonCrystalLeafCount || 0} 项；灰机 ${source.huiji || 0} 件 · nbb 回退 ${source.nbb || 0} 件。${baseMaterialMeta.missing?.length ? ` 未覆盖：${baseMaterialMeta.missing.join('、')}` : ''}</div>`;
    const basicHeader = state.basicCategory === 'equipment' ? sourceNotice : '';
    root.innerHTML = `<div class="header"><div><div class="meta">材料指导价 &gt; 基础材料价格</div><h1>基础材料价格</h1><div class="sub">市场平均价来自 Universalis 中国区；采购均价基于全部历史含税采购记录。</div></div><button id="refresh-market" class="btn${state.marketRefreshing ? ' refreshing' : ''}" ${state.marketRefreshing ? 'disabled' : ''}>${state.marketRefreshing ? '刷新中…' : '统一刷新市场价'}</button></div>${state.marketMessage ? '<div class="status">'+state.marketMessage+'</div>' : ''}${basicSelect + basicHeader + basicContent}`;
    decorateRetainerNotes(root);
    decorateSourceNotes(root);
    root.querySelector('#refresh-market').onclick = () => refreshMarket(true);
    root.querySelectorAll('[data-purchase]').forEach(button => button.onclick = () => {
      const material = data.m.find(item => item.id === button.dataset.purchase);
      if (material) openPurchaseManager(material);
    });
    const basicCategory = root.querySelector('#basic-category');
    if (basicCategory) {
      basicCategory.value = state.basicCategory;
      basicCategory.onchange = () => { state.basicCategory = basicCategory.value; renderGuide(); };
    }
    const combatGrade = root.querySelector('#combat-grade'), gatheringGrade = root.querySelector('#gathering-grade');
    if (combatGrade) { combatGrade.value = state.equipmentCombatTier; combatGrade.onchange = () => { state.equipmentCombatTier = combatGrade.value; renderGuide(); }; }
    if (gatheringGrade) { gatheringGrade.value = state.equipmentGatheringTier; gatheringGrade.onchange = () => { state.equipmentGatheringTier = gatheringGrade.value; renderGuide(); }; }
    const otherSearch = root.querySelector('#other-material-form');
    if (otherSearch) otherSearch.onsubmit = event => { event.preventDefault(); state.otherSearch = root.querySelector('#other-material-search').value.trim(); renderGuide(); };
    root.querySelectorAll('[data-add-other]').forEach(button => button.onclick = async () => {
      const material = otherSearchResults(state.otherSearch).find(row => String(row.uid) === button.dataset.addOther);
      if (material) { await addOtherMaterial(material); renderGuide(); }
    });
    root.querySelectorAll('[data-material-category]').forEach(details => details.ontoggle = () => {
      if (state.guideCategories[details.dataset.materialCategory] === details.open) return;
      state.guideCategories[details.dataset.materialCategory] = details.open;
      if (details.open) renderGuide();
    });
    const manageNpc = root.querySelector('#manage-npc-materials');
    if (manageNpc) manageNpc.onclick = openNpcMaterialManager;
    const ticketCostForm = root.querySelector('#ticket-unit-cost-form');
    if (ticketCostForm) ticketCostForm.onsubmit = event => {
      event.preventDefault();
      const value = Number(root.querySelector('#ticket-unit-cost').value || 0);
      if (!(value > 0)) return alert('请输入大于 0 的天穹票默认价格。');
      submarineTicketSettings.defaultUnitCost = value;
      invalidatePlans(); invalidateGuideIndexes(); save(); renderGuide();
    };
    const resetTicketCost = root.querySelector('#reset-ticket-unit-cost');
    if (resetTicketCost) resetTicketCost.onclick = () => {
      submarineTicketSettings.defaultUnitCost = DEFAULT_TICKET_UNIT_COST;
      invalidatePlans(); invalidateGuideIndexes(); save(); renderGuide();
    };
    root.querySelectorAll('[data-npc-detail]').forEach(button => button.onclick = () => openNpcMaterialDetail(button.dataset.npcDetail));
    root.querySelectorAll('[data-source-detail]').forEach(button => button.onclick = () => openSubmarineMaterialSourceDetail(button.dataset.sourceDetail));
    root.querySelectorAll('[data-retainer]').forEach(button => button.onclick = () => openRetainerDetail(button.dataset.retainer));
    maybeRefreshMarket();
  }
  function openSubmarineMaterialSourceDetail(uid) {
    const material = data.m.find(item => String(item.uid) === String(uid));
    if (!material) return;
    const choice = submarineSourceChoice(material);
    const rows = choice.options.map(option => `<tr class="${option.key === choice.key && option.key === 'npc' ? 'npc-row' : ''}"><td>${option.key === choice.key ? recommendationTag(option, '当前推荐') : ''}${option.label}</td><td>${Number(option.price) > 0 ? money(option.price) : '—'}</td><td class="label">${option.source}</td><td class="label"><small class="meta">${option.formula || '未获取有效价格'}</small></td></tr>`).join('');
    const craftRows = submarineCraftInputBreakdown(material.uid);
    const craftRecipe = (graphRecipes[String(material.uid)] || [])[0], craftYield = Math.max(1, Number(craftRecipe?.y) || 1);
    const craftBatchTotal = craftRows.reduce((sum, row) => sum + row.batchTotal, 0), craftTotal = craftBatchTotal / craftYield;
    const craftMissing = craftRows.some(row => !(row.unit > 0));
    const craftFooter = craftYield > 1
      ? `批次合价 ${craftMissing ? '部分未获取' : money(craftBatchTotal)} ÷ 每批产出 ${craftYield} 个`
      : '按当前来源制作成本';
    const craftTable = craftRows.length ? `<section class="sales-history"><h3>自制成本采用的下级来源${craftYield > 1 ? ` · 每批产出 ${craftYield} 个` : ''}</h3><div class="table-wrap history-table"><table class="ledger"><thead><tr><th>下级材料</th><th>数量</th><th>采用方式</th><th>单价</th><th>${craftYield > 1 ? '批次合价' : '合价'}</th></tr></thead><tbody>${craftRows.map(row => `<tr><td class="label">${materialName(row.uid)}</td><td>${Number(row.batchQuantity.toFixed(4))}</td><td>${recommendationTag(row.choice, row.choice.label)}</td><td>${row.unit > 0 ? money(row.unit) : '未获取'}</td><td>${row.unit > 0 ? money(row.batchTotal) : '—'}</td></tr>`).join('')}</tbody><tfoot><tr><th colspan="4">${craftFooter}</th><th>${craftMissing ? '部分未获取' : money(craftTotal)}</th></tr></tfoot></table></div></section>` : '';
    document.querySelector('#bundle-detail-meta').textContent = '材料指导价 > 潜水艇推荐材料 > 来源比价';
    document.querySelector('#bundle-detail-title').textContent = material.n + '来源比价';
    document.querySelector('#bundle-detail-content').innerHTML = `<div class="cards"><div class="card"><small>推荐方式</small><b>${choice.label}</b><div class="meta">${choice.source}</div></div><div class="card"><small>当前最低有效单价</small><b>${choice.price > 0 ? money(choice.price) : '待补价'}</b><div class="meta">仅比较有效的正数价格</div></div></div><section class="sales-history"><h3>取得方式单价对比</h3><div class="table-wrap history-table"><table class="ledger"><thead><tr><th>渠道</th><th>单价</th><th>数据来源</th><th>计算依据</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="empty">暂无可用渠道</td></tr>'}</tbody></table></div></section>${craftTable}`;
    if (!document.querySelector('#bundle-detail-dialog').open) document.querySelector('#bundle-detail-dialog').showModal();
  }
  function openNpcMaterialDetail(uid) {
    const material = data.m.find(item => String(item.uid) === String(uid)), comparison = npcComparison(uid), leaves = [...selfCraftLeafIds(uid)].map(leafId => {
      const leaf = data.m.find(item => String(item.uid) === String(leafId)), unit = materialUnitPrice(leaf);
      return { name: materialName(leafId), quantity: 1, cost: unit, uid: Number(leafId) };
    }).sort((left, right) => left.uid - right.uid);
    if (!material || !comparison || !comparison.hasCraftRoute) return;
    document.querySelector('#bundle-detail-meta').textContent = '材料指导价 > 潜水艇推荐材料 > NPC 购买材料';
    document.querySelector('#bundle-detail-title').textContent = material.n + ' 采购与自制详情';
    const choice = npcCostChoice(material, comparison), purchase = purchaseAverage(material);
    document.querySelector('#bundle-detail-content').innerHTML = `<div class="cards"><div class="card"><small>NPC 采购价</small><b>${money(comparison.price)}</b><div class="meta">${comparison.source}</div></div><div class="card"><small>采购平均价</small><b>${purchase > 0 ? money(purchase) : '未采购'}</b><div class="meta">全历史含税采购均价</div></div><div class="card"><small>当前采用成本</small><b>${money(choice.price)}</b><div class="meta">${choice.source}较低</div></div><div class="card"><small>自制价格</small><b>${comparison.self == null ? '等待市场价' : money(comparison.self)}</b><div class="meta">按当前采购均价 / 市场均价递归估算</div></div></div><section class="sales-history"><h3>自制基础素材参考</h3>${costTable(leaves, '参考成本', comparison.self || 0)}</section>`;
    if (!document.querySelector('#bundle-detail-dialog').open) document.querySelector('#bundle-detail-dialog').showModal();
  }
  function openNpcMaterialManager() {
    const dialog = document.querySelector('#npc-material-dialog');
    const catalog = submarineCatalogIds();
    const entries = submarineNpcMaterials();
    document.querySelector('#npc-material-list').innerHTML = `<div class="table-wrap history-table"><table class="ledger"><thead><tr><th>材料</th><th>NPC 售卖价</th><th>采购平均价</th><th>自制价</th><th>购买来源</th><th>记录采购</th><th>操作</th></tr></thead><tbody>${entries.map(material => { const spec = npcMaterial(material), comparison = npcComparison(material.uid), purchase = purchaseAverage(material), craftable = comparison?.hasCraftRoute; return `<tr class="npc-row"><td class="label">${craftable ? `<button class="bundle-link" data-npc-detail="${material.uid}">${material.n}</button>` : material.n}</td><td>${money(spec.price)}</td><td>${purchase > 0 ? money(purchase) : '未采购'}</td><td>${craftable ? (comparison.self == null ? '等待市场价' : money(comparison.self)) : '—'}</td><td>${spec.source}</td><td><button class="btn secondary" data-purchase="${material.id}">记录采购</button></td><td><button class="btn secondary" data-npc-remove="${material.uid}">移出 NPC 分类</button></td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">暂无 NPC 固定材料</td></tr>'}</tbody></table></div>`;
    document.querySelector('#npc-material-search').oninput = event => {
      const query = event.target.value.trim().toLowerCase();
      const results = otherSearchResults(query).filter(material => catalog.has(String(material.uid))).slice(0, 30);
      document.querySelector('#npc-material-results').innerHTML = !query ? '' : `<div class="table-wrap history-table"><table class="ledger"><thead><tr><th>材料</th><th>物品 ID</th><th></th></tr></thead><tbody>${results.map(material => `<tr><td class="label">${material.n}</td><td>${material.uid}</td><td><button class="btn secondary" data-npc-select="${material.uid}">设为 NPC 材料</button></td></tr>`).join('') || '<tr><td colspan="3" class="empty">未找到潜水艇推荐材料名录内的匹配材料。</td></tr>'}</tbody></table></div>`;
      document.querySelectorAll('[data-npc-select]').forEach(button => button.onclick = () => {
        const material = results.find(row => String(row.uid) === button.dataset.npcSelect);
        if (!material) return;
        document.querySelector('#npc-material-id').value = material.uid;
        document.querySelector('#npc-material-name').value = material.n;
        document.querySelector('#npc-material-price').focus();
      });
    };
    document.querySelectorAll('[data-npc-remove]').forEach(button => button.onclick = () => {
      const uid = String(button.dataset.npcRemove), builtIn = Boolean(materialSources[uid]?.npc);
      if (builtIn) npcMaterialConfig.disabled = [...new Set([...(npcMaterialConfig.disabled || []), uid])];
      else delete npcMaterialConfig.added?.[uid];
      invalidateNpcMaterials(); ensureSubmarineMaterials(); syncPurchaseCosts(); save(); openNpcMaterialManager(); renderGuide();
    });
    document.querySelectorAll('[data-purchase]').forEach(button => button.onclick = () => {
      const material = data.m.find(item => item.id === button.dataset.purchase);
      if (material) openPurchaseManager(material);
    });
    document.querySelectorAll('[data-npc-detail]').forEach(button => button.onclick = () => openNpcMaterialDetail(button.dataset.npcDetail));
    if (!dialog.open) dialog.showModal();
  }
  function periodPurchases(material) {
    const now = new Date(), mode = state.purchasePeriod || 'month', start = new Date(now);
    if (mode === 'week') start.setDate(now.getDate() - 6);
    if (mode === 'month') start.setMonth(now.getMonth(), 1);
    if (mode === 'year') start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    return purchaseRows(material).filter(row => new Date(row.date) >= start);
  }
  function openPurchaseManager(material) {
    state.purchaseManagerMaterialId = material.id;
    renderPurchaseManager();
  }
  const purchaseSourceLabel = row => row?.kind === 'exchange'
    ? `兑换采购 · ${row.exchangeSource || '兑换'}`
    : '直接采购';
  function renderPurchaseManager() {
    const material = data.m.find(item => item.id === state.purchaseManagerMaterialId);
    const dialog = document.querySelector('#purchase-manager-dialog');
    if (!material) { if (dialog.open) dialog.close(); return; }
    const visible = periodPurchases(material);
    const values = visible.map(row => Number(row.unitPrice || 0)).filter(Boolean);
    const quantity = visible.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const average = purchaseAverage(material);
    document.querySelector('#purchase-manager-meta').textContent = isCrystal(material) ? '材料指导价 > 水晶价格' : '材料指导价 > 基础材料价格';
    document.querySelector('#purchase-manager-title').textContent = material.n + '采购价格';
    document.querySelector('#purchase-manager-average').textContent = `全历史采购均价：${purchaseAverage(material) ? money(purchaseAverage(material)) : '暂无采购记录'}`;
    document.querySelector('#purchase-manager-content').innerHTML = `<div class="purchase-stats"><div class="card metric"><small>本期最高单价</small><b>${values.length ? money(Math.max(...values)) : '—'}</b></div><div class="card metric"><small>本期最低单价</small><b>${values.length ? money(Math.min(...values)) : '—'}</b></div><div class="card metric"><small>采购平均单价</small><b>${average ? money(average) : '—'}</b></div></div><div class="filter"><button class="btn secondary" data-manager-period="week">周</button><button class="btn secondary" data-manager-period="month">月</button><button class="btn secondary" data-manager-period="year">年</button></div><div class="table-wrap"><table class="ledger"><thead><tr><th>日期</th><th>来源</th><th>购买数量</th><th>单价</th><th>税率</th><th>合价（含税）</th><th>操作</th></tr></thead><tbody>${visible.map(row => `<tr><td>${row.date}</td><td>${purchaseSourceLabel(row)}</td><td>${row.quantity}</td><td>${money(row.unitPrice)}</td><td>${Math.round(row.tax * 100)}%</td><td>${money(row.total)}</td><td><button class="btn secondary" data-manager-edit="${row.id}">编辑</button> <button class="btn secondary" data-manager-delete="${row.id}">删除</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">本期暂无采购记录</td></tr>'}</tbody></table></div>`;
    document.querySelector('#purchase-manager-add').onclick = () => openPurchase(material);
    document.querySelectorAll('[data-manager-period]').forEach(button => {
      button.classList.toggle('active', button.dataset.managerPeriod === (state.purchasePeriod || 'month'));
      button.onclick = () => { state.purchasePeriod = button.dataset.managerPeriod; renderPurchaseManager(); };
    });
    document.querySelectorAll('[data-manager-edit]').forEach(button => button.onclick = () => { const entry = purchases.find(row => row.id === button.dataset.managerEdit); if (entry) openPurchase(material, entry); });
    document.querySelectorAll('[data-manager-delete]').forEach(button => button.onclick = () => {
      const index = purchases.findIndex(row => row.id === button.dataset.managerDelete);
      if (index < 0 || !confirm('删除这条采购记录？删除后会重算采购均价。')) return;
      purchases.splice(index, 1); refreshNpcRecommendations(); save(); renderPurchaseManager(); renderGuide();
    });
    if (!dialog.open) dialog.showModal();
  }
  function renderPurchaseDetail() {
    const material = data.m.find(item => item.id === state.selectedMaterial);
    if (!material) { state.guideView = 'crystals'; return renderGuide(); }
    const visible = periodPurchases(material);
    const values = visible.map(row => row.unitPrice);
    const quantity = visible.reduce((sum, row) => sum + row.quantity, 0);
    const average = quantity ? visible.reduce((sum, row) => sum + row.total, 0) / quantity : 0;
    const title = isCrystal(material) ? '水晶价格' : '基础材料价格';
    document.querySelector('#guide').innerHTML = `<div class="header"><div><div class="meta">材料指导价 &gt; ${title} &gt; ${material.n}</div><h1>${material.n}采购价格</h1><div class="sub">采购均价 ${purchaseAverage(material) ? money(purchaseAverage(material)) : '未采购'}</div></div><div><button id="back-guide" class="btn secondary">← 返回材料价格</button> <button id="add-purchase" class="btn">+ 记录采购</button></div></div><div class="cards"><div class="card metric"><small>本期最高单价</small><b>${values.length ? money(Math.max(...values)) : '—'}</b></div><div class="card metric"><small>本期最低单价</small><b>${values.length ? money(Math.min(...values)) : '—'}</b></div><div class="card metric"><small>本期平均单价</small><b>${values.length ? money(average) : '—'}</b></div></div><div class="filter"><button class="btn secondary" data-period="week">周</button><button class="btn secondary" data-period="month">月</button><button class="btn secondary" data-period="year">年</button></div><div class="table-wrap"><table class="ledger"><thead><tr><th>日期</th><th>购买数量</th><th>单价</th><th>税率</th><th>合价（含税）</th><th>操作</th></tr></thead><tbody>${visible.map(row => `<tr><td>${row.date}</td><td>${row.quantity}</td><td>${money(row.unitPrice)}</td><td>${Math.round(row.tax * 100)}%</td><td>${money(row.total)}</td><td><button class="btn secondary" data-edit-purchase="${row.id}">编辑</button> <button class="btn secondary" data-delete-purchase="${row.id}">删除</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">本期暂无采购记录</td></tr>'}</tbody></table></div>`;
    document.querySelector('#back-guide').onclick = () => { state.guideView = isCrystal(material) ? 'crystals' : 'basic'; state.selectedMaterial = null; render(); };
    document.querySelector('#add-purchase').onclick = () => openPurchase(material);
    document.querySelectorAll('[data-edit-purchase]').forEach(button => button.onclick = () => openPurchase(material, purchases.find(row => row.id === button.dataset.editPurchase)));
    document.querySelectorAll('[data-delete-purchase]').forEach(button => button.onclick = () => {
      const index = purchases.findIndex(row => row.id === button.dataset.deletePurchase);
      if (index < 0 || !confirm('删除这条采购记录？删除后会重算采购均价。')) return;
      purchases.splice(index, 1); refreshNpcRecommendations(); save(); renderPurchaseDetail();
    });
    document.querySelectorAll('[data-period]').forEach(button => {
      button.classList.toggle('active', button.dataset.period === (state.purchasePeriod || 'month'));
      button.onclick = () => { state.purchasePeriod = button.dataset.period; renderPurchaseDetail(); };
    });
  }
  function openPurchase(material, purchase = null) {
    const matchingRoutes = exchangeRoutesFor(material.uid).map(route => ({ ...route, index: route.routeIndex }));
    const kind = document.querySelector('#purchase-kind');
    kind.innerHTML = `<option value="direct">直接市场购买</option>${matchingRoutes.map(route => `<option value="exchange:${route.index}">${route.kind} · ${route.label}</option>`).join('')}`;
    kind.value = purchase?.kind === 'exchange' ? `exchange:${purchase.exchangeRoute}` : 'direct';
    document.querySelector('#purchase-kind-label').hidden = matchingRoutes.length === 0;
    document.querySelector('#purchase-voucher-summary').hidden = true;
    document.querySelector('#purchase-title').textContent = (purchase ? '编辑采购 ' : '采购 ') + material.n;
    document.querySelector('#purchase-date').value = purchase?.date || today();
    document.querySelector('#purchase-quantity').value = purchase?.kind === 'exchange' ? '' : (purchase?.quantity || '');
    document.querySelector('#purchase-tax').value = String(purchase?.tax ?? 0.05);
    document.querySelector('#purchase-unit').value = purchase?.kind === 'exchange' ? '' : (purchase?.unitPrice || '');
    document.querySelector('#purchase-total').value = purchase?.kind === 'exchange' ? '' : (purchase?.total || '');
    document.querySelector('#purchase-exchange-turns').value = purchase?.exchangeTurns || 1;
    document.querySelector('#purchase-source-price').value = purchase?.exchangeSourceUnitPrice || '';
    state.purchaseEditMode = 'unit'; state.selectedMaterial = material.id;
    state.editingPurchaseId = purchase?.id || null;
    const syncMode = (applyDefault = false) => {
      const routeIndex = kind.value.startsWith('exchange:') ? Number(kind.value.slice(9)) : null;
      const route = routeIndex == null ? null : exchangeSources.routes?.[routeIndex];
      const exchangeFields = document.querySelector('#purchase-exchange-fields'), directFields = document.querySelector('#purchase-direct-fields');
      exchangeFields.hidden = !route; directFields.hidden = Boolean(route);
      if (!route) return;
      const sourceMaterial = route.carrierId ? data.m.find(item => String(item.uid) === String(route.carrierId)) : null;
      const sourceField = document.querySelector('#purchase-source-price');
      const defaultPrice = route.carrierId ? directSourceChoice(sourceMaterial).price : ticketUnitCost();
      if (applyDefault && sourceField.value === '') sourceField.value = defaultPrice || '';
      sourceField.readOnly = false;
      document.querySelector('#purchase-source-price-label').firstChild.textContent = route.carrierId ? `${sourceMaterial?.n || '凭证'}单价（G / 个）` : '天穹票单价（G / 张）';
      document.querySelector('#purchase-exchange-note').textContent = route.carrierId
        ? `不维护凭证库存；本次兑换按填写的 ${sourceMaterial?.n || '凭证'} 单价结转。`
        : `天穹票不可囤货；每次使用 ${route.ticketCost} 张，默认 ${money(ticketUnitCost())} / 张。`;
      const turns = Math.max(0, Number(document.querySelector('#purchase-exchange-turns').value || 0));
      const outputQuantity = Number(route.outputs?.[String(material.uid)] || 0) * turns;
      const sourceQuantity = route.carrierId ? turns : turns * Number(route.ticketCost || 0);
      const total = Math.max(0, Number(document.querySelector('#purchase-source-price').value || 0)) * sourceQuantity;
      document.querySelector('#purchase-exchange-summary').innerHTML = `获得数量：<b>${outputQuantity}</b> · 合价：<b>${money(total)}</b> · 换算单价：<b>${outputQuantity ? money(total / outputQuantity) : '—'}</b>`;
    };
    state.syncPurchaseMode = syncMode;
    kind.onchange = () => { document.querySelector('#purchase-source-price').value = ''; syncMode(true); };
    document.querySelector('#purchase-exchange-turns').oninput = () => syncMode(false);
    document.querySelector('#purchase-source-price').oninput = () => syncMode(false);
    syncMode(true);
    document.querySelector('#purchase-dialog').showModal();
  }

  const equipmentProfitSummary = type => {
    const rows = ledgerRows(type);
    const realizedProfit = bundle => sales().filter(entry => entry.bundleId === bundle.id).reduce((sum, entry) => sum + Number(entry.profit || 0), 0);
    const groupStats = [...new Set(rows.map(item => item.group))].map(group => [group, rows.filter(item => item.group === group).reduce((sum, item) => sum + realizedProfit(item), 0)]);
    const totalProfit = groupStats.reduce((sum, [, profit]) => sum + profit, 0);
    const label = type === '770' ? '战职装备 · 770 HQ' : '生产采集装备 · 750 HQ';
    return `<section class="profit-summary"><h2>${label}</h2><table class="ledger"><tbody><tr><th>${type}合计利润</th><td>${money(totalProfit)}</td></tr>${groupStats.map(([group, profit]) => `<tr><td>${group}</td><td>${money(profit)}</td></tr>`).join('')}</tbody></table><div class="note">统计已完成装备销售的实际净利润。</div></section>`;
  };
  function openSalesHistory() {
    const prefix = state.type + '-';
    const rows = sales().filter(entry => String(entry.bundleId || '').startsWith(prefix));
    document.querySelector('#sales-history-title').textContent = state.type === '770' ? '战职装备销售记录' : '生产采集装备销售记录';
    document.querySelector('#sales-history-content').innerHTML = `<div class="table-wrap history-table"><table class="ledger"><thead><tr><th>日期</th><th>职业 / 分项</th><th>数量</th><th>成交额</th><th>销售成本</th><th>利润</th></tr></thead><tbody>${rows.map(entry => `<tr><td>${entry.date}</td><td class="label">${entry.item}</td><td>${entry.q}</td><td>${money(entry.amount)}</td><td>${money(entry.cost)}</td><td class="profit">${money(entry.profit)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">暂无销售记录</td></tr>'}</tbody></table></div>`;
    document.querySelector('#sales-history-dialog').showModal();
  }
  function renderEquipment() {
    const root = document.querySelector('#equipment');
    if (!state.type) {
      root.innerHTML = `<div class="header"><div><h1>装备售卖</h1><div class="sub">7.5 装备销售利润统计；点击左侧二级菜单进入对应台账。</div></div></div><div class="equipment-summaries">${equipmentProfitSummary('770')}${equipmentProfitSummary('750')}</div>`;
      return;
    }
    const combat = state.type === '770';
    const rows = tableRows(state.type);
    const tier = combat ? '770 HQ' : '750 HQ';
    const actionMarkup = (item, kind) => kind === 'craft'
      ? `<div class="op-actions"><button class="op-btn craft" data-action="craft-plus" data-row="${item.id}">制作入库 +1</button><button class="op-btn undo" data-action="craft-minus" data-row="${item.id}" ${automaticLogs('craft', item.id).length ? '' : 'disabled'}>撤销</button></div>`
      : `<div class="op-actions"><button class="op-btn sale" data-action="sale-plus" data-row="${item.id}" ${inventory(item) ? '' : 'disabled'}>售卖 +1</button><button class="op-btn undo" data-action="sale-minus" data-row="${item.id}" ${automaticLogs('sale', item.id).length ? '' : 'disabled'}>撤销</button></div>`;
    const toolLabel = combat ? '武器' : '工具';
    root.innerHTML = `<div class="header"><div><div class="meta">装备售卖 &gt; ${combat ? '战职装备' : '生产采集装备'} &gt; 7.5</div><h1>${combat ? '战职装备售卖台账' : '生产采集装备售卖台账'}</h1><div class="sub">7.5 · ${tier} · 点击职业组可展开；防具、首饰和${toolLabel}默认收起。</div></div><div><label class="meta" style="display:inline-grid;gap:5px;margin-right:8px">装备品级<select id="equipment-tier"><option value="${state.type}">${tier}</option></select></label><button id="back" class="btn secondary">← 返回装备售卖</button> <button id="open-history" class="btn secondary">销售记录</button> <button id="open-template" class="btn secondary">统一调整套装价格</button> <button id="open-custom" class="btn">自定义成交价</button></div></div><div class="table-wrap"><table class="ledger"><thead><tr><th>职业 / 分项</th><th>库存数量</th><th>制作</th><th>售卖</th><th>成本价</th><th>套装价</th><th>利润</th><th>利润比</th></tr></thead><tbody>${rows.map(item => {
      if (item.header) return `<tr class="group-row"><td colspan="8"><button class="group-toggle" data-group="${item.header}">${iconMarkup(groupIconPaths[item.header], item.header)}<span>${item.header}</span><b>${state.equipmentGroups[item.header] ? '⌃' : '⌄'}</b></button></td></tr>`;
      if (!state.equipmentGroups[item.group]) return '';
      const partsKey = item.group + '-parts';
      if ((item.pricePart === 'armor' || item.pricePart === 'accessory') && !state.equipmentSections[partsKey]) return '';
      const cost = unitCost(item), price = priceFor(item), profit = price - cost, inventoryCount = inventory(item);
      const icon = item.job ? iconMarkup(jobIconPaths[item.job], item.label) : iconMarkup(groupIconPaths[item.group], item.label);
      const tool = item.tool;
      const toolKey = item.id + '-tool';
      const toolMarkup = tool && state.equipmentSections[toolKey] ? `<tr class="tool-strip"><td colspan="8"><div class="tool-chip"><button class="bundle-link" data-detail="${tool.id}">${iconMarkup(jobIconPaths[item.job], tool.label)}${tool.label}</button><span class="meta">成本 ${money(unitCost(tool))} · 售价 ${money(priceFor(tool))} · 库存 ${inventory(tool)}</span>${actionMarkup(tool, 'craft')}${actionMarkup(tool, 'sale')}</div></td></tr>` : '';
      const partsToggle = item.pricePart === 'gear' ? `<button class="section-toggle" data-section="${partsKey}">${state.equipmentSections[partsKey] ? '收起防具 / 首饰' : '展开防具 / 首饰'}</button>` : '';
      const toolToggle = tool ? `<button class="section-toggle" data-section="${toolKey}">${state.equipmentSections[toolKey] ? '收起' + toolLabel : '展开' + toolLabel}</button>` : '';
      return `<tr class="${item.indent ? 'detail' : ''}"><td class="label"><button class="bundle-link" data-detail="${item.id}">${icon}${item.label}</button>${partsToggle}${toolToggle}</td><td><b>${inventoryCount}</b></td><td>${actionMarkup(item, 'craft')}</td><td>${actionMarkup(item, 'sale')}</td><td>${money(cost)}</td><td class="price" data-price="${item.id}">${money(price)}</td><td class="profit">${money(profit)}</td><td class="margin">${cost ? Math.round(profit / cost * 100) + '%' : '—'}</td></tr>${toolMarkup}`;
    }).join('')}</tbody></table></div><div class="note">制作与售卖数量不显示；库存数量自动按“制作 − 售卖”计算。售卖 + 按当前套装价自动入账。</div>`;
    root.querySelector('#back').onclick = () => { state.type = null; state.expanded = true; render(); };
    root.querySelector('#open-history').onclick = openSalesHistory;
    root.querySelector('#open-template').onclick = openPriceTemplate;
    root.querySelector('#open-custom').onclick = openCustomSale;
    root.querySelectorAll('[data-group]').forEach(button => button.onclick = () => { state.equipmentGroups[button.dataset.group] = !state.equipmentGroups[button.dataset.group]; renderEquipment(); });
    root.querySelectorAll('[data-section]').forEach(button => button.onclick = () => { state.equipmentSections[button.dataset.section] = !state.equipmentSections[button.dataset.section]; renderEquipment(); });
    const allRows = ledgerRows(state.type);
    root.querySelectorAll('[data-action]').forEach(button => button.onclick = () => changeBundle(button.dataset.action, allRows.find(item => item.id === button.dataset.row)));
    root.querySelectorAll('[data-price]').forEach(cell => cell.onclick = () => editPrice(allRows.find(item => item.id === cell.dataset.price)));
    root.querySelectorAll('[data-detail]').forEach(button => button.onclick = () => openBundleDetail(allRows.find(item => item.id === button.dataset.detail)));
  }

  const submarineRow = part => ({ id: 'submarine-' + part.id, partId: part.id, group: part.n.replace(/(船体|船尾|船首|舰桥)$/, ''), label: part.n, priceKey: 'submarine-price-' + part.id, components: componentList([[part.id, 1]]) });
  const submarineRows = () => (submarineData.parts || []).map(submarineRow);
  const submarineStock = part => submarineStocks[part.id] || { q: 0, v: 0, made: 0, sold: 0 };
  const setSubmarineStock = (part, value) => { submarineStocks[part.id] = value; };
  const submarinePrice = part => prices['submarine-price-' + part.id] || 0;
  const submarineHistory = part => submarineSales.filter(sale => Number(sale.partId) === Number(part.id));
  const submarineSlots = ['船体', '船尾', '船首', '舰桥'];
  const suiteLabel = suite => suite.label || (suite.code + (suite.modified ? '改' : ''));
  const suiteParts = suite => suite.code.split('').map((digit, index) => {
    const level = Number(digit), slot = submarineSlots[index];
    if (!level) return null;
    return submarineData.parts.find(part => part.part === slot && (suite.modified ? /改级/.test(part.n) : !/改级/.test(part.n)) && new RegExp('^' + ['','鲨鱼','甲鲎','须鲸','腔棘鱼','希尔德拉'][level]).test(part.n)) || null;
  });
  const suitePrice = suite => prices[suite.priceKey] || 0;
  const suiteStock = suite => {
    const parts = suiteParts(suite).filter(Boolean);
    return parts.length ? Math.min(...parts.map(part => submarineStock(part).q)) : 0;
  };
  const suiteCost = suite => suiteParts(suite).filter(Boolean).reduce((sum, part) => {
    const value = submarineStock(part); return sum + (value.q ? value.v / value.q : productionPlan(submarineRow(part)).total);
  }, 0);
  const suiteHistory = suite => submarineSuiteSales.filter(sale => sale.suiteId === suite.id);
  const lastSubmarineOperation = (kind, targetId) => submarineOperations.find(entry => entry.kind === kind && String(entry.targetId) === String(targetId));
  const submarineOperation = (kind, targetId, quantity, deltas, saleId = null) => {
    submarineOperations.unshift({ id: 'sub-op-' + Date.now() + '-' + Math.random().toString(16).slice(2), kind, targetId: String(targetId), quantity, deltas, saleId, date: today() });
  };
  function submarineSellSuite(suite, price = suitePrice(suite), date = today(), quantity = 1) {
    quantity = Math.max(1, Number(quantity) || 1);
    const parts = suiteParts(suite).filter(Boolean);
    if (!parts.length || suiteStock(suite) < quantity) throw new Error('该整套库存不足，不能售卖。');
    const recipeCosts = parts.map(part => { const value = submarineStock(part), cost = value.v / value.q * quantity; return { partId: part.id, qty: quantity, cost }; });
    recipeCosts.forEach(entry => { const part = submarineData.parts.find(item => Number(item.id) === Number(entry.partId)); const value = submarineStock(part); value.q -= entry.qty; value.v -= entry.cost; value.sold = (value.sold || 0) + entry.qty; setSubmarineStock(part, value); });
    const cost = recipeCosts.reduce((sum, row) => sum + row.cost, 0), amount = Number(price || 0) * quantity;
    const sale = { id: 'sub-suite-sale-' + Date.now(), suiteId: suite.id, item: '潜水艇整套 ' + suiteLabel(suite), date, q: quantity, amount, cost, profit: amount - cost, recipeCosts };
    submarineSuiteSales.unshift(sale);
    submarineOperation('suite-sale', suite.id, quantity, recipeCosts.map(entry => ({ ...entry })), sale.id);
  }
  function openSubmarineSuiteSale(suite) {
    state.pendingSubmarineSuite = suite.id;
    const cost = suiteCost(suite), stockCount = suiteStock(suite), price = suitePrice(suite);
    document.querySelector('#submarine-suite-sale-title').textContent = '确认整套售卖 · ' + suiteLabel(suite);
    document.querySelector('#submarine-suite-sale-price').value = price || '';
    document.querySelector('#submarine-suite-sale-quantity').value = 1;
    document.querySelector('#submarine-suite-sale-quantity').max = stockCount;
    document.querySelector('#submarine-suite-sale-summary').innerHTML = `<div>当前可售 ${stockCount} 套 · ${suiteParts(suite).filter(Boolean).map(part => part.n).join('、')}</div><div style="margin-top:8px">成本 ${money(cost)} · 建议售价 ${money(price)} · 预计利润 ${money(price - cost)}</div>`;
    document.querySelector('#submarine-suite-sale-dialog').showModal();
  }
  function openSubmarineSuiteEditor(suite = null) {
    state.editingSubmarineSuite = suite?.id || null;
    document.querySelector('#submarine-suite-title').textContent = suite ? '编辑潜水艇整套' : '新增潜水艇整套';
    document.querySelector('#submarine-suite-code').value = suite?.code || '';
    document.querySelector('#submarine-suite-modified').checked = Boolean(suite?.modified);
    document.querySelector('#submarine-suite-price').value = suite ? suitePrice(suite) : '';
    document.querySelector('#submarine-suite-dialog').showModal();
  }
  function submarineCraft(part, quantity = 1) {
    quantity = Math.max(1, Number(quantity) || 1);
    const bundle = submarineRow(part), plan = productionPlan(bundle);
    if (plan.missing.length) throw new Error('缺少成本：' + plan.missing.join('、'));
    const value = submarineStock(part);
    const cost = plan.total * quantity;
    value.q += quantity; value.v += cost; value.made = (value.made || 0) + quantity;
    setSubmarineStock(part, value);
    submarineOperation('part-craft', part.id, quantity, [{ partId: part.id, qty: quantity, cost }]);
  }
  function submarineCraftSuite(suite, quantity = 1) {
    quantity = Math.max(1, Number(quantity) || 1);
    const parts = suiteParts(suite).filter(Boolean);
    if (!parts.length) throw new Error('该整套未包含可制作部件。');
    const deltas = parts.map(part => { const plan = productionPlan(submarineRow(part)); if (plan.missing.length) throw new Error('缺少成本：' + plan.missing.join('、')); return { partId: part.id, qty: quantity, cost: plan.total * quantity }; });
    deltas.forEach(entry => { const part = submarineData.parts.find(item => Number(item.id) === Number(entry.partId)); const value = submarineStock(part); value.q += entry.qty; value.v += entry.cost; value.made = (value.made || 0) + entry.qty; setSubmarineStock(part, value); });
    submarineOperation('suite-craft', suite.id, quantity, deltas);
  }
  function submarineSell(part, price = submarinePrice(part), date = today(), quantity = 1) {
    quantity = Math.max(1, Number(quantity) || 1);
    const value = submarineStock(part);
    if (value.q < quantity) throw new Error('部件库存不足，不能售卖。');
    const cost = value.v / value.q * quantity;
    value.q -= quantity; value.v -= cost; value.sold = (value.sold || 0) + quantity;
    setSubmarineStock(part, value);
    const amount = Number(price || 0) * quantity;
    const sale = { id: 'sub-sale-' + Date.now(), partId: part.id, item: part.n, date, q: quantity, amount, cost, profit: amount - cost };
    submarineSales.unshift(sale);
    submarineOperation('part-sale', part.id, quantity, [{ partId: part.id, qty: quantity, cost }], sale.id);
  }
  function undoSubmarineOperation(kind, targetId) {
    const index = submarineOperations.findIndex(entry => entry.kind === kind && String(entry.targetId) === String(targetId));
    if (index < 0) throw new Error('没有可撤销的最近操作。');
    const operation = submarineOperations[index], craft = /craft$/.test(kind);
    if (craft && operation.deltas.some(entry => submarineStock(submarineData.parts.find(part => Number(part.id) === Number(entry.partId))).q < entry.qty)) throw new Error('已有部件售出，不能撤销这次制作。');
    operation.deltas.forEach(entry => {
      const part = submarineData.parts.find(item => Number(item.id) === Number(entry.partId)), value = submarineStock(part);
      if (craft) { value.q -= entry.qty; value.v -= entry.cost; value.made = Math.max(0, (value.made || 0) - entry.qty); }
      else { value.q += entry.qty; value.v += entry.cost; value.sold = Math.max(0, (value.sold || 0) - entry.qty); }
      setSubmarineStock(part, value);
    });
    if (!craft) {
      const list = kind === 'suite-sale' ? submarineSuiteSales : submarineSales;
      const saleIndex = list.findIndex(entry => entry.id === operation.saleId);
      if (saleIndex >= 0) list.splice(saleIndex, 1);
    }
    submarineOperations.splice(index, 1);
  }
  const netDeltas = (entries, deltasFor, signFor, idKey) => entries.reduce((totals, entry) => {
    const sign = signFor(entry);
    deltasFor(entry).forEach(delta => {
      const id = String(delta[idKey]);
      if (!id || !Number(delta.qty)) return;
      const value = totals.get(id) || { q: 0, v: 0 };
      value.q += sign * Number(delta.qty);
      value.v += sign * Number(delta.cost || 0);
      totals.set(id, value);
    });
    return totals;
  }, new Map());
  function migrateLegacyInventories() {
    let changed = false;
    const submarineNet = netDeltas(submarineOperations, entry => entry.deltas || [], entry => /craft$/.test(entry.kind) ? 1 : -1, 'partId');
    submarineData.parts.forEach(part => {
      const current = submarineStock(part), tracked = submarineNet.get(String(part.id)) || { q: 0, v: 0 };
      const quantity = Math.max(0, Number(current.q || 0) - tracked.q);
      if (!quantity) return;
      submarineOperations.unshift({ id: 'legacy-sub-op-' + part.id, kind: 'part-craft', targetId: String(part.id), quantity, deltas: [{ partId: part.id, qty: quantity, cost: Math.max(0, Number(current.v || 0) - tracked.v) }], date: today(), legacyMigration: true });
      changed = true;
    });
    const equipmentNet = netDeltas(data.l.filter(entry => entry.type === '制作' || entry.type === '出售'), entry => entry.recipeCosts || [], entry => entry.type === '制作' ? 1 : -1, 'id');
    const activeItems = new Map(['770', '750'].flatMap(ledgerRows).flatMap(bundle => bundle.components).filter(component => component.item).map(component => [String(component.item.id), component.item]));
    activeItems.forEach((item, id) => {
      const current = stock(id), tracked = equipmentNet.get(id) || { q: 0, v: 0 };
      const quantity = Math.max(0, Number(current.q || 0) - tracked.q);
      if (!quantity) return;
      const cost = Math.max(0, Number(current.v || 0) - tracked.v);
      data.l.unshift({ id: 'legacy-craft-' + id, date: today(), type: '制作', item: '历史入库 · ' + item.n, q: quantity, amount: cost, cost, autoKind: 'legacy-craft', bundleId: 'legacy-stock-' + id, recipeCosts: [{ id: item.id, qty: quantity, cost }], legacyMigration: true });
      changed = true;
    });
    return changed;
  }
  function openSubmarineCraft(target, isSuite = false) {
    state.pendingSubmarineCraft = { id: target.id, isSuite };
    document.querySelector('#submarine-craft-title').textContent = '制作入库 · ' + (isSuite ? suiteLabel(target) : target.n);
    document.querySelector('#submarine-craft-quantity-label').firstChild.textContent = isSuite ? '制作套数' : '制作数量';
    document.querySelector('#submarine-craft-quantity').value = 1;
    document.querySelector('#submarine-craft-summary').innerHTML = isSuite ? `<div>${suiteParts(target).filter(Boolean).map(part => part.n).join('、')}</div><div class="meta" style="margin-top:8px">每套预计成本 ${money(suiteCost(target))}</div>` : `<div>${target.n}</div><div class="meta" style="margin-top:8px">每件预计成本 ${money(productionPlan(submarineRow(target)).total)}</div>`;
    document.querySelector('#submarine-craft-dialog').showModal();
  }
  function openSubmarineSale(part) {
    const stockValue = submarineStock(part), price = submarinePrice(part), cost = stockValue.q ? stockValue.v / stockValue.q : 0;
    state.pendingSubmarineSale = part.id;
    document.querySelector('#submarine-sale-quantity').value = 1;
    document.querySelector('#submarine-sale-quantity').max = stockValue.q;
    document.querySelector('#submarine-sale-price').value = price || '';
    document.querySelector('#submarine-sale-title').textContent = '确认售卖 · ' + part.n;
    document.querySelector('#submarine-sale-summary').innerHTML = `<div>当前库存 ${stockValue.q}</div><div style="margin-top:8px">售价 ${money(price)} · 销售成本 ${money(cost)} · 预计利润 ${money(price - cost)}</div>`;
    document.querySelector('#submarine-sale-dialog').showModal();
  }
  const submarineRawRecipe = (uid, parentJob = null) => {
    const recipes = submarineData.g?.[String(uid)] || graphRecipes[String(uid)] || [];
    return recipes.find(recipe => parentJob != null && Number(recipe.j) === Number(parentJob)) || recipes[0] || null;
  };
  const submarineRawInputs = (recipe, quantity = 1) => {
    if (!recipe) return [];
    const yieldCount = Math.max(1, Number(recipe.y) || 1), inputs = [];
    for (let index = 0; index < recipe.a.length; index += 2) {
      const uid = Number(recipe.a[index]), amount = Number(recipe.a[index + 1] || 0);
      if (uid > 0 && amount > 0) inputs.push({ uid, quantity: quantity * amount / yieldCount, parentJob: recipe.j });
    }
    return inputs;
  };
  function openSubmarineRecipeReference(uid) {
    const recipe = submarineRawRecipe(uid);
    if (!recipe) return;
    const yieldCount = Math.max(1, Number(recipe.y) || 1);
    // 参考窗口按一整批配方展示；成本表尾再除以产出量得到单件成本。
    const direct = submarineRawInputs(recipe, yieldCount);
    const leaves = new Map();
    const expand = (itemId, quantity, parentJob = null, trail = new Set()) => {
      const node = submarineRawRecipe(itemId, parentJob), key = `${itemId}@${node?.id || node?.j || 'leaf'}`;
      if (!node || trail.has(key)) {
        leaves.set(String(itemId), (leaves.get(String(itemId)) || 0) + quantity);
        return;
      }
      const next = new Set(trail); next.add(key);
      submarineRawInputs(node, quantity).forEach(input => expand(input.uid, input.quantity, input.parentJob, next));
    };
    expand(uid, yieldCount);
    const pricedRows = rows => rows.map(row => {
      const material = data.m.find(item => String(item.uid) === String(row.uid)) || { uid: String(row.uid), n: materialName(row.uid) };
      const choice = submarineSourceChoice(material), unit = Number(choice.price || 0), total = unit * Number(row.quantity || 0);
      return { ...row, choice, unit, total };
    });
    const materialRows = rows => rows.map(row => `<tr><td class="label">${recommendationTag(row.choice)}${materialName(row.uid)}</td><td>${Number(row.quantity.toFixed(4))}</td><td>${row.unit > 0 ? money(row.unit) : '未获取'}</td><td>${row.unit > 0 ? money(row.total) : '—'}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">暂无配方数据</td></tr>';
    const referenceTable = (rows, label) => {
      const priced = pricedRows(rows), total = priced.reduce((sum, row) => sum + row.total, 0), missing = priced.some(row => !(row.unit > 0));
      const footer = yieldCount > 1
        ? `${label} · 批次合价 ${missing ? '部分未获取' : money(total)} ÷ 每批产出 ${yieldCount} 个`
        : label;
      return `<div class="table-wrap history-table"><table class="ledger"><thead><tr><th>材料</th><th>数量</th><th>参考单价</th><th>${yieldCount > 1 ? '批次合价' : '参考合价'}</th></tr></thead><tbody>${materialRows(priced)}</tbody><tfoot><tr><th colspan="3">${footer}</th><th>${missing ? '部分未获取' : money(total / yieldCount)}</th></tr></tfoot></table></div>`;
    };
    const leafRows = [...leaves.entries()].map(([itemId, quantity]) => ({ uid: Number(itemId), quantity })).sort((left, right) => left.uid - right.uid);
    const chosenCostRows = submarineCraftInputBreakdown(uid).map(row => ({ ...row, quantity: row.batchQuantity }));
    document.querySelector('#recipe-reference-title').textContent = materialName(uid) + '制作配方参考';
    document.querySelector('#recipe-reference-content').innerHTML = `<div class="cards"><div class="card"><small>制作职业</small><b>${recipe.j === 0 ? '部队合建' : '职业 ' + recipe.j}</b></div><div class="card"><small>每批产出</small><b>${yieldCount}</b></div></div><section class="sales-history"><h3>直接制作素材</h3>${referenceTable(direct, '直接素材参考成本')}</section><section class="sales-history"><h3>当前最低来源制作成本</h3>${referenceTable(chosenCostRows, '按当前来源制作成本')}</section><section class="sales-history"><h3>递归基础素材参考</h3>${referenceTable(leafRows, '基础素材参考成本')}</section>`;
    document.querySelector('#recipe-reference-dialog').showModal();
  }
  // 潜水艇详情的合建层保持工房根配方；下层只沿统一生产计划实际展开的节点展示。
  // 这样 NPC、市场与兑换成本终点不会泄漏下级素材，且每一栏都能复用同一份批次成本分摊。
  function submarineDetailLayers(plan, part) {
    const rawRecipe = submarineRawRecipe;
    const rawInputs = submarineRawInputs;
    const materialFor = uid => data.m.find(material => String(material.uid) === String(uid)) || { uid: String(uid), n: materialName(uid) };
    const sourceChoiceFor = uid => submarineSourceChoice(materialFor(uid));
    const isNpcTerminal = uid => sourceChoiceFor(uid).key === 'npc';
    const isExchangeTerminal = uid => isExchangeChoice(sourceChoiceFor(uid));
    const isMarketTerminal = uid => ['direct-purchase', 'direct-market'].includes(sourceChoiceFor(uid).key);
    // 仅可制作的非潜水艇部件半成品才进入“市场采购材料”分区；
    // 矿石、水晶等市场原材料仍是成本终点，但保留在“其余材料”。
    const isMarketIntermediateTerminal = uid => isMarketTerminal(uid) && Boolean(rawRecipe(uid)) && !submarinePartIds().has(String(uid));
    // 市场、NPC 与兑换均为实际取得成本终点；只有推荐自制的半成品才继续展开配方。
    const isCostTerminal = uid => isNpcTerminal(uid) || isExchangeTerminal(uid) || isMarketTerminal(uid);
    const planKeyFor = (uid, parentJob = null) => {
      const node = recipeNodeFor(uid, parentJob, 'submarine');
      return node ? nodeKey(uid, node) : `leaf@${uid}`;
    };
    // 原始配方用于展示层级；当前采用 NPC / 兑换渠道的子项保留其渠道单价，
    // 其余成本再在可制作子项间分摊，避免详情出现不属于任何取得方式的混合单价。
    const distributeCost = (requests, totalCost) => {
      if (!requests.length) return requests;
      const weighted = requests.map(request => {
        const choice = sourceChoiceFor(request.uid), terminal = isCostTerminal(request.uid);
        return { ...request, choice, terminal, weight: Number(choice.price || 0) * Number(request.quantity || 0) };
      });
      const fixedCost = weighted.filter(request => request.terminal).reduce((sum, request) => sum + request.weight, 0);
      const flexible = weighted.filter(request => !request.terminal);
      const distributable = Math.max(0, Number(totalCost || 0) - fixedCost);
      const totalWeight = flexible.reduce((sum, request) => sum + request.weight, 0) || flexible.reduce((sum, request) => sum + Number(request.quantity || 0), 0) || 1;
      let allocated = 0;
      return weighted.map((request, index) => {
        if (request.terminal) return { ...request, cost: request.weight };
        const remainingFlexible = flexible.at(-1) === request;
        const cost = remainingFlexible ? distributable - allocated : distributable * ((request.weight || request.quantity || 0) / totalWeight);
        allocated += cost;
        return { ...request, cost };
      });
    };
    const merge = (requests, pinnedNpcIds = new Set(), pinnedExchangeIds = new Set(), pinnedMarketIds = new Set()) => {
      const rows = new Map();
      requests.forEach(request => {
        const key = String(request.uid), sourceChoice = sourceChoiceFor(request.uid), existing = rows.get(key) || {
          uid: Number(request.uid), name: materialName(request.uid), quantity: 0, cost: 0,
          pinnedNpc: pinnedNpcIds.has(key), pinnedExchange: pinnedExchangeIds.has(key),
          pinnedMarket: pinnedMarketIds.has(key),
          sourceChoice
        };
        existing.quantity += Number(request.quantity || 0);
        existing.cost += request.cost ?? plan.allocationCost(request.key || planKeyFor(request.uid, request.parentJob), Number(request.quantity || 0));
        rows.set(key, existing);
      });
      // 仅“由合建层直接下放”的 NPC 终点置顶；原本属于直接/基础层的 NPC 材料保留原排序。
      return [...rows.values()].sort((left, right) => Number(right.pinnedNpc) - Number(left.pinnedNpc) || Number(right.pinnedExchange) - Number(left.pinnedExchange) || Number(right.pinnedMarket) - Number(left.pinnedMarket) || left.uid - right.uid);
    };
    const rootRecipe = rawRecipe(part.id);
    const root = plan.roots.find(entry => Number(entry.uid) === Number(part.id));
    const rootEntry = root && plan.nodes.get(root.key);
    // 优先使用计划中的根节点输入（包含配方产出批次），异常时才回退到原始工房配方。
    const assemblyRequests = rootEntry
      ? rootEntry.inputs.map(input => ({ ...input, quantity: input.quantity * root.quantity / Math.max(rootEntry.needed, 1), parentJob: rootEntry.node.j }))
      : rawInputs(rootRecipe, 1).map(request => ({ ...request, key: planKeyFor(request.uid, request.parentJob) }));
    const requestCost = request => request.cost ?? plan.allocationCost(request.key || planKeyFor(request.uid, request.parentJob), Number(request.quantity || 0));
    const childRequests = request => {
      const requestKey = request.key || planKeyFor(request.uid, request.parentJob);
      // 生产计划已经把外购、NPC、兑换材料作为叶子时，详情也必须在此终止，
      // 不能继续展开后再人为分摊成本。
      if (requestKey.startsWith('leaf@') || isCostTerminal(request.uid)) return [{ ...request, key: requestKey, cost: requestCost(request) }];
      const recipe = rawRecipe(request.uid, request.parentJob);
      if (!recipe) return [{ ...request, key: requestKey, cost: requestCost(request) }];
      return distributeCost(rawInputs(recipe, request.quantity), requestCost(request));
    };
    // 合建材料为 NPC / 兑换终点时，本身作为直接素材终点，并在各自分区中标记。
    const directRequests = assemblyRequests.flatMap(childRequests);
    // 直接素材的顶部来源分区只收纳由合建层直接下放的终点；下级材料仍保留原配方位置。
    const directPinnedNpcIds = new Set(assemblyRequests.filter(request => isNpcTerminal(request.uid)).map(request => String(request.uid)));
    const directPinnedExchangeIds = new Set(assemblyRequests.filter(request => isExchangeTerminal(request.uid)).map(request => String(request.uid)));
    const directPinnedMarketIds = new Set(assemblyRequests.filter(request => isMarketIntermediateTerminal(request.uid)).map(request => String(request.uid)));
    const basicRequests = [];
    const expandBasic = (request, trail = new Set()) => {
      const requestKey = request.key || planKeyFor(request.uid, request.parentJob);
      if (trail.has(requestKey) || requestKey.startsWith('leaf@') || isCostTerminal(request.uid)) { basicRequests.push({ ...request, key: requestKey }); return; }
      const recipe = rawRecipe(request.uid, request.parentJob);
      if (!recipe) { basicRequests.push({ ...request, key: requestKey }); return; }
      const next = new Set(trail); next.add(requestKey);
      distributeCost(rawInputs(recipe, request.quantity), requestCost(request)).forEach(child => expandBasic(child, next));
    };
    directRequests.forEach(request => expandBasic(request));
    // 基础素材将实际采用 NPC / 兑换成本、因而停止递归的材料置顶。
    const basicPinnedNpcIds = new Set(basicRequests.filter(request => isNpcTerminal(request.uid)).map(request => String(request.uid)));
    const basicPinnedExchangeIds = new Set(basicRequests.filter(request => isExchangeTerminal(request.uid)).map(request => String(request.uid)));
    const basicPinnedMarketIds = new Set(basicRequests.filter(request => isMarketIntermediateTerminal(request.uid)).map(request => String(request.uid)));
    return { assembly: merge(assemblyRequests), direct: merge(directRequests, directPinnedNpcIds, directPinnedExchangeIds, directPinnedMarketIds), basic: merge(basicRequests, basicPinnedNpcIds, basicPinnedExchangeIds, basicPinnedMarketIds) };
  }
  function openSubmarineDetail(part, showBasicNpc = true) {
    const plan = productionPlan(submarineRow(part)), layers = submarineDetailLayers(plan, part), history = submarineHistory(part);
    document.querySelector('#bundle-detail-meta').textContent = '潜水艇售卖 > ' + part.n;
    document.querySelector('#bundle-detail-title').textContent = part.n + '详情';
    const direct = layers.direct;
    const basic = showBasicNpc ? layers.basic : layers.basic.filter(row => !row.pinnedNpc);
    document.querySelector('#bundle-detail-content').innerHTML = `${plan.missing.length ? `<div class="status">以下基础材料未获取单价：${plan.missing.join('、')}。</div>` : ''}<div class="detail-columns four"><section class="detail-column"><h3>成品清单</h3>${costTable(plan.finished, '成品清单总成本', plan.total, { submarine: true })}</section><section class="detail-column"><h3>合建制作材料</h3>${costTable(layers.assembly, '合建制作材料总成本', plan.total, { submarine: true })}</section><section class="detail-column"><h3>直接素材</h3>${costTable(direct, '直接素材总成本', plan.total, { npcSection: true, sourceSections: true, submarine: true })}</section><section class="detail-column"><h3>基础素材 <button class="section-toggle" data-sub-detail-basic>${showBasicNpc ? '隐藏 NPC 材料' : '显示 NPC 材料'}</button></h3>${costTable(basic, '基础素材总成本', plan.total, { npcSection: showBasicNpc, sourceSections: true, submarine: true })}</section></div><section class="sales-history"><div class="history-head"><h3>历史销售记录</h3></div><div class="table-wrap history-table"><table class="ledger"><thead><tr><th>日期</th><th>销售额</th><th>销售成本</th><th>利润</th></tr></thead><tbody>${history.map(entry => `<tr><td>${entry.date}</td><td>${money(entry.amount)}</td><td>${money(entry.cost)}</td><td class="profit">${money(entry.profit)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">暂无销售记录</td></tr>'}</tbody></table></div></section>`;
    document.querySelector('[data-sub-detail-basic]').onclick = () => openSubmarineDetail(part, !showBasicNpc);
    document.querySelectorAll('[data-sub-recipe-reference]').forEach(button => button.onclick = () => openSubmarineRecipeReference(Number(button.dataset.subRecipeReference)));
    if (!document.querySelector('#bundle-detail-dialog').open) document.querySelector('#bundle-detail-dialog').showModal();
  }
  const submarineSalesTotals = rows => rows.reduce((total, row) => ({ amount: total.amount + Number(row.amount || 0), cost: total.cost + Number(row.cost || 0), profit: total.profit + Number(row.profit || 0), quantity: total.quantity + Number(row.q || 1) }), { amount: 0, cost: 0, profit: 0, quantity: 0 });
  function openSubmarineReport(title, records) {
    document.querySelector('#overview-sales-title').textContent = title;
    document.querySelector('#overview-sales-content').innerHTML = salesTable(records.map(row => ({ ...row, source: row.suiteId ? '潜水艇整套' : '潜水艇单件', q: Number(row.q) || 1 })));
    document.querySelector('#overview-sales-dialog').showModal();
  }
  function openSubmarineSuiteDetail(suite) {
    const parts = suiteParts(suite).filter(Boolean), history = suiteHistory(suite), cost = suiteCost(suite), price = suitePrice(suite);
    document.querySelector('#bundle-detail-meta').textContent = '潜水艇售卖 > 整套 ' + suiteLabel(suite);
    document.querySelector('#bundle-detail-title').textContent = suiteLabel(suite) + ' 套装详情';
    document.querySelector('#bundle-detail-content').innerHTML = `<div class="cards"><div class="card"><small>剩余套数</small><b>${suiteStock(suite)}</b></div><div class="card"><small>每套成本</small><b>${money(cost)}</b></div><div class="card"><small>建议售价</small><b>${money(price)}</b></div><div class="card"><small>预计利润</small><b>${money(price - cost)}</b></div></div><div class="table-wrap history-table"><table class="ledger"><thead><tr><th>部位</th><th>部件</th><th>库存</th><th>单件成本</th></tr></thead><tbody>${parts.map(part => `<tr><td>${part.part}</td><td class="label"><button class="bundle-link" data-suite-part-detail="${part.id}">${part.n}</button></td><td>${submarineStock(part).q}</td><td>${money(submarineStock(part).q ? submarineStock(part).v / submarineStock(part).q : productionPlan(submarineRow(part)).total)}</td></tr>`).join('')}</tbody></table></div><section class="sales-history"><h3>整套销售历史</h3>${salesTable(history.map(row => ({ ...row, source: '潜水艇整套' })))}</section>`;
    document.querySelectorAll('[data-suite-part-detail]').forEach(button => button.onclick = () => openSubmarineDetail(submarineData.parts.find(part => String(part.id) === button.dataset.suitePartDetail)));
    if (!document.querySelector('#bundle-detail-dialog').open) document.querySelector('#bundle-detail-dialog').showModal();
  }
  function renderSubmarineSummary() {
    {
      const root = document.querySelector('#submarine');
      const suiteRows = submarineSuites.map(suite => { const total = submarineSalesTotals(suiteHistory(suite)); return `<tr><td class="label"><button class="bundle-link" data-summary-suite="${suite.id}">${suiteLabel(suite)}</button></td><td>${total.quantity}</td><td class="profit">${money(total.profit)}</td><td class="margin">${total.cost ? Math.round(total.profit / total.cost * 100) + '%' : '—'}</td><td><button class="btn secondary" data-summary-suite-sales="${suite.id}">查看明细</button></td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">暂无整套销售记录</td></tr>';
      const slots = ['船体', '船尾', '船首', '舰桥'];
      const levelNames = [...new Set(submarineData.parts.map(part => part.n.replace(/(船体|船尾|船首|舰桥)$/, '')))];
      const partRows = levelNames.map(level => `<tr><td class="label">${level}</td>${slots.map(slot => { const part = submarineData.parts.find(item => item.part === slot && item.n.replace(/(船体|船尾|船首|舰桥)$/, '') === level); if (!part) return '<td>—</td>'; const total = submarineSalesTotals(submarineHistory(part)); return `<td><button class="bundle-link" data-summary-part="${part.id}">${total.quantity ? money(total.profit) : '—'}</button></td>`; }).join('')}</tr>`).join('');
      root.innerHTML = `<div class="header"><div><div class="meta">潜水艇售卖</div><h1>潜水艇销售利润统计</h1><div class="sub">整套利润与单件利润分开统计；点击名称或利润可查看销售明细。</div></div><button id="go-submarine-ledger" class="btn">进入潜水艇台账</button></div><section class="profit-summary" style="margin-top:20px"><h2>整套利润</h2><div class="table-wrap history-table"><table class="ledger"><thead><tr><th>套装简称</th><th>已售套数</th><th>利润</th><th>利润率</th><th>明细</th></tr></thead><tbody>${suiteRows}</tbody></table></div></section><section class="profit-summary" style="margin-top:20px"><h2>单件售卖总利润</h2><div class="table-wrap history-table"><table class="ledger"><thead><tr><th>潜水艇名称</th>${slots.map(slot => `<th>${slot}</th>`).join('')}</tr></thead><tbody>${partRows || `<tr><td colspan="${slots.length + 1}" class="empty">暂无单件部件</td></tr>`}</tbody></table></div></section>`;
      const suiteProfit = submarineSalesTotals(submarineSuiteSales).profit;
      const partProfit = submarineSalesTotals(submarineSales).profit;
      const totalProfit = suiteProfit + partProfit;
      const totals = document.createElement('div');
      totals.className = 'cards submarine-profit-totals';
      totals.innerHTML = `<div class="card metric"><small>套装总销售利润合计</small><b class="profit">${money(suiteProfit)}</b></div><div class="card metric"><small>单件售卖利润合计</small><b class="profit">${money(partProfit)}</b></div><div class="card metric"><small>潜水艇总利润合计</small><b class="profit">${money(totalProfit)}</b></div>`;
      root.querySelector('.header').after(totals);
      root.querySelector('#go-submarine-ledger').onclick = () => { state.submarineView = 'ledger'; renderSubmarine(); };
      root.querySelectorAll('[data-summary-suite]').forEach(button => button.onclick = () => openSubmarineSuiteDetail(submarineSuites.find(item => item.id === button.dataset.summarySuite)));
      root.querySelectorAll('[data-summary-suite-sales]').forEach(button => button.onclick = () => { const suite = submarineSuites.find(item => item.id === button.dataset.summarySuiteSales); if (suite) openSubmarineReport(suiteLabel(suite) + ' 销售明细', suiteHistory(suite)); });
      root.querySelectorAll('[data-summary-part]').forEach(button => button.onclick = () => { const part = submarineData.parts.find(item => String(item.id) === button.dataset.summaryPart); if (part) openSubmarineReport(part.n + ' 销售明细', submarineHistory(part)); });
      return;
    }
    const root = document.querySelector('#submarine'), suite = submarineSalesTotals(submarineSuiteSales), part = submarineSalesTotals(submarineSales), stockValue = Object.values(submarineStocks).reduce((sum, value) => sum + Number(value.v || 0), 0), stockCount = Object.values(submarineStocks).reduce((sum, value) => sum + Number(value.q || 0), 0);
    root.innerHTML = `<div class="header"><div><h1>潜水艇销售利润</h1><div class="sub">整套与单件销售独立统计，并同步计入总览销售流水。</div></div><button id="go-submarine-ledger" class="btn">进入潜水艇台账</button></div><div class="cards"><button class="card metric clickable" data-sub-report="suite"><small>整套销售 · 查看明细</small><b>${money(suite.amount)}</b><div class="meta">${suite.quantity} 套 · 成本 ${money(suite.cost)} · 利润 ${money(suite.profit)}</div></button><button class="card metric clickable" data-sub-report="part"><small>单件销售 · 查看明细</small><b>${money(part.amount)}</b><div class="meta">${part.quantity} 件 · 成本 ${money(part.cost)} · 利润 ${money(part.profit)}</div></button><div class="card metric"><small>潜水艇销售合计</small><b>${money(suite.amount + part.amount)}</b><div class="meta">成本 ${money(suite.cost + part.cost)} · 利润 ${money(suite.profit + part.profit)}</div></div><div class="card metric"><small>当前部件库存</small><b>${stockCount}</b><div class="meta">库存成本 ${money(stockValue)}</div></div></div><section class="profit-summary"><h2>整套销售利润</h2><div class="table-wrap history-table"><table class="ledger"><thead><tr><th>套装</th><th>销售套数</th><th>销售额</th><th>成本</th><th>利润</th><th>利润率</th></tr></thead><tbody>${submarineSuites.map(item => { const total = submarineSalesTotals(suiteHistory(item)); return `<tr data-sub-suite-report="${item.id}"><td class="label"><button class="bundle-link" data-suite-detail="${item.id}">${suiteLabel(item)}</button></td><td>${total.quantity}</td><td>${money(total.amount)}</td><td>${money(total.cost)}</td><td class="profit">${money(total.profit)}</td><td class="margin">${total.cost ? Math.round(total.profit / total.cost * 100) + '%' : '—'}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">暂无整套配置</td></tr>'}</tbody></table></div></section><section class="profit-summary"><h2>单件销售利润</h2><div class="table-wrap history-table"><table class="ledger"><thead><tr><th>部件</th><th>销售数量</th><th>销售额</th><th>成本</th><th>利润</th><th>利润率</th></tr></thead><tbody>${submarineData.parts.map(item => { const total = submarineSalesTotals(submarineHistory(item)); return `<tr data-sub-part-report="${item.id}"><td class="label"><button class="bundle-link" data-submarine-detail="${item.id}">${item.n}</button></td><td>${total.quantity}</td><td>${money(total.amount)}</td><td>${money(total.cost)}</td><td class="profit">${money(total.profit)}</td><td class="margin">${total.cost ? Math.round(total.profit / total.cost * 100) + '%' : '—'}</td></tr>`; }).join('')}</tbody></table></div></section>`;
    root.querySelector('#go-submarine-ledger').onclick = () => { state.submarineView = 'ledger'; renderSubmarine(); };
    root.querySelectorAll('[data-sub-report]').forEach(button => button.onclick = () => openSubmarineReport(button.dataset.subReport === 'suite' ? '潜水艇整套销售明细' : '潜水艇单件销售明细', button.dataset.subReport === 'suite' ? submarineSuiteSales : submarineSales));
    root.querySelectorAll('[data-suite-detail]').forEach(button => button.onclick = () => openSubmarineSuiteDetail(submarineSuites.find(item => item.id === button.dataset.suiteDetail)));
    root.querySelectorAll('[data-sub-suite-report]').forEach(row => row.onclick = event => { if (!event.target.closest('button')) openSubmarineReport('整套 ' + suiteLabel(submarineSuites.find(item => item.id === row.dataset.subSuiteReport)) + ' 销售明细', suiteHistory(submarineSuites.find(item => item.id === row.dataset.subSuiteReport))); });
    root.querySelectorAll('[data-sub-part-report]').forEach(row => row.onclick = event => { if (!event.target.closest('button')) { const part = submarineData.parts.find(item => String(item.id) === row.dataset.subPartReport); openSubmarineReport(part.n + ' 销售明细', submarineHistory(part)); } });
    root.querySelectorAll('[data-submarine-detail]').forEach(button => button.onclick = () => openSubmarineDetail(submarineData.parts.find(part => String(part.id) === button.dataset.submarineDetail)));
  }
  function renderSubmarine() {
    if (state.submarineView !== 'ledger') return renderSubmarineSummary();
    const root = document.querySelector('#submarine'), rows = submarineRows(), groups = [...new Set(rows.map(row => row.group))];
    // 兼容旧台账模板；统计区会在挂载后移除，利润仅在父级页面呈现。
    const statisticRows = [];
    const suiteRows = submarineSuites.map(suite => { const parts = suiteParts(suite), cost = suiteCost(suite), price = suitePrice(suite), profit = price - cost; return `<tr><td class="label"><button class="bundle-link" data-suite-detail="${suite.id}">${suiteLabel(suite)}</button></td><td><b>${suiteStock(suite)}</b></td><td><button class="op-btn sale" data-suite-sell="${suite.id}" ${suiteStock(suite) ? '' : 'disabled'}>整套出售</button><button class="op-btn undo" data-suite-undo-sale="${suite.id}" ${lastSubmarineOperation('suite-sale', suite.id) ? '' : 'disabled'}>撤销</button></td><td><button class="op-btn craft" data-suite-craft="${suite.id}">制作入库</button><button class="op-btn undo" data-suite-undo-craft="${suite.id}" ${lastSubmarineOperation('suite-craft', suite.id) ? '' : 'disabled'}>撤销</button></td><td class="price" data-suite-price="${suite.id}">${money(price)}</td><td>${money(cost)}</td><td class="profit">${money(profit)}</td><td class="margin">${cost ? Math.round(profit / cost * 100) + '%' : '—'}</td>${parts.map(part => `<td>${part ? `<span title="库存 ${submarineStock(part).q}">${part.n.replace(/级(船体|船尾|船首|舰桥)$/, '')} <small class="meta">${submarineStock(part).q}</small></span>` : '0'}</td>`).join('')}<td class="compact-actions"><button class="btn secondary" data-suite-edit="${suite.id}">编辑</button><button class="btn secondary" data-suite-delete="${suite.id}">删除</button></td></tr>`; }).join('');
    root.innerHTML = `<div class="header"><div><div class="meta">潜水艇售卖</div><h1>潜水艇售卖台账</h1><div class="sub">整套与单件均支持按数量制作、出售与撤销。</div></div><button id="add-submarine-suite" class="btn">+ 新增整套</button></div><section class="profit-summary" style="margin-top:20px"><h2>潜水艇销售利润统计</h2><div class="table-wrap history-table"><table class="ledger"><thead><tr><th>类别</th><th>套装 / 部件</th><th>已售数量</th><th>利润</th><th>利润率</th><th>明细</th></tr></thead><tbody>${statisticRows.map(row => `<tr><td>${row.type}</td><td class="label">${row.detail === 'suite' ? `<button class="bundle-link" data-suite-detail="${row.id}">${row.label}</button>` : `<button class="bundle-link" data-submarine-detail="${row.id}">${row.label}</button>`}</td><td>${row.total.quantity}</td><td class="profit">${money(row.total.profit)}</td><td class="margin">${row.total.cost ? Math.round(row.total.profit / row.total.cost * 100) + '%' : '—'}</td><td><button class="btn secondary" data-submarine-stat-detail="${row.detail}:${row.id}">查看销售明细</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">暂无潜水艇销售记录</td></tr>'}</tbody></table></div></section><div class="table-wrap"><table class="ledger"><thead><tr><th>套装简称</th><th>剩余套数</th><th>整套出售</th><th>制作入库</th><th>建议售价</th><th>成本</th><th>利润</th><th>利润率</th><th>船体</th><th>船尾</th><th>船首</th><th>舰桥</th><th>操作</th></tr></thead><tbody>${suiteRows || '<tr><td colspan="13" class="empty">暂无潜水艇整套</td></tr>'}</tbody></table></div><details id="submarine-parts-details" class="material-category" style="margin-top:20px" ${state.submarinePartsOpen ? 'open' : ''}><summary>单部件制作与售卖<span>按等级展开</span></summary><div class="table-wrap"><table class="ledger"><thead><tr><th>潜水艇等级 / 部件</th><th>库存</th><th>制作</th><th>售卖</th><th>成本价</th><th>建议售价</th><th>利润</th><th>利润率</th></tr></thead><tbody>${groups.map(group => { const expanded = state.submarineGroups[group]; return `<tr class="group-row"><td colspan="8"><button class="group-toggle" data-submarine-group="${group}"><span>${group}</span><b>${expanded ? '⌃' : '⌄'}</b></button></td></tr>${expanded ? rows.filter(row => row.group === group).map(row => { const part = submarineData.parts.find(item => item.id === row.partId), value = submarineStock(part), cost = value.q ? value.v / value.q : productionPlan(row).total, price = submarinePrice(part), profit = price - cost; return `<tr class="detail"><td class="label"><button class="bundle-link" data-submarine-detail="${part.id}">${part.n}</button></td><td><b>${value.q}</b></td><td><button class="op-btn craft" data-submarine-craft="${part.id}">制作入库</button><button class="op-btn undo" data-submarine-undo-craft="${part.id}" ${lastSubmarineOperation('part-craft', part.id) ? '' : 'disabled'}>撤销</button></td><td><button class="op-btn sale" data-submarine-sell="${part.id}" ${value.q ? '' : 'disabled'}>出售</button><button class="op-btn undo" data-submarine-undo-sale="${part.id}" ${lastSubmarineOperation('part-sale', part.id) ? '' : 'disabled'}>撤销</button></td><td>${money(cost)}</td><td class="price" data-submarine-price="${part.id}">${money(price)}</td><td class="profit">${money(profit)}</td><td class="margin">${cost ? Math.round(profit / cost * 100) + '%' : '—'}</td></tr>`; }).join('') : ''}`; }).join('')}</tbody></table></div></details>`;
    // 利润统计只在“潜水艇售卖”父级页面展示，台账保持为纯操作区。
    root.querySelector('section.profit-summary')?.remove();
    root.querySelector('.table-wrap .ledger')?.querySelectorAll('tr').forEach(row => {
      const cells = [...row.children];
      if (cells.length > 3) row.insertBefore(cells[3], cells[2]);
    });
    root.querySelector('#submarine-parts-details').ontoggle = event => { state.submarinePartsOpen = event.currentTarget.open; };
    root.querySelectorAll('[data-submarine-group]').forEach(button => button.onclick = () => { state.submarineGroups[button.dataset.submarineGroup] = !state.submarineGroups[button.dataset.submarineGroup]; renderSubmarine(); });
    root.querySelectorAll('[data-submarine-craft]').forEach(button => button.onclick = () => openSubmarineCraft(submarineData.parts.find(part => String(part.id) === button.dataset.submarineCraft)));
    root.querySelectorAll('[data-suite-craft]').forEach(button => button.onclick = () => openSubmarineCraft(submarineSuites.find(suite => suite.id === button.dataset.suiteCraft), true));
    root.querySelectorAll('[data-submarine-sell]').forEach(button => button.onclick = () => openSubmarineSale(submarineData.parts.find(part => String(part.id) === button.dataset.submarineSell)));
    root.querySelectorAll('[data-submarine-undo-craft],[data-submarine-undo-sale],[data-suite-undo-craft],[data-suite-undo-sale]').forEach(button => button.onclick = () => { const isSuite = button.hasAttribute('data-suite-undo-craft') || button.hasAttribute('data-suite-undo-sale'); const sale = button.hasAttribute('data-submarine-undo-sale') || button.hasAttribute('data-suite-undo-sale'); const targetId = button.dataset.submarineUndoCraft || button.dataset.submarineUndoSale || button.dataset.suiteUndoCraft || button.dataset.suiteUndoSale; try { undoSubmarineOperation((isSuite ? 'suite' : 'part') + '-' + (sale ? 'sale' : 'craft'), targetId); save(); renderSubmarine(); } catch (error) { alert(error.message || '撤销失败。'); } });
    root.querySelectorAll('[data-submarine-detail]').forEach(button => button.onclick = () => openSubmarineDetail(submarineData.parts.find(part => String(part.id) === button.dataset.submarineDetail)));
    root.querySelectorAll('[data-suite-detail]').forEach(button => button.onclick = () => openSubmarineSuiteDetail(submarineSuites.find(suite => suite.id === button.dataset.suiteDetail)));
    root.querySelectorAll('[data-submarine-price]').forEach(cell => { cell.onclick = () => { const part = submarineData.parts.find(item => String(item.id) === cell.dataset.submarinePrice); state.editingPriceKey = 'submarine-price-' + part.id; document.querySelector('#single-price-title').textContent = '调整' + part.n + '建议售价'; document.querySelector('#single-price-value').value = submarinePrice(part) || ''; document.querySelector('#single-price-dialog').showModal(); }; });
    root.querySelector('#add-submarine-suite').onclick = () => openSubmarineSuiteEditor();
    root.querySelectorAll('[data-suite-sell]').forEach(button => button.onclick = () => openSubmarineSuiteSale(submarineSuites.find(suite => suite.id === button.dataset.suiteSell)));
    root.querySelectorAll('[data-suite-edit]').forEach(button => button.onclick = () => openSubmarineSuiteEditor(submarineSuites.find(suite => suite.id === button.dataset.suiteEdit)));
    root.querySelectorAll('[data-suite-delete]').forEach(button => button.onclick = () => { const index = submarineSuites.findIndex(suite => suite.id === button.dataset.suiteDelete); if (index >= 0 && confirm('删除该整套配置？历史销售记录会保留。')) { submarineSuites.splice(index, 1); save(); renderSubmarine(); } });
    root.querySelectorAll('[data-suite-price]').forEach(cell => cell.onclick = () => { const suite = submarineSuites.find(item => item.id === cell.dataset.suitePrice); state.editingPriceKey = suite.priceKey; document.querySelector('#single-price-title').textContent = '调整整套 ' + suiteLabel(suite) + '建议售价'; document.querySelector('#single-price-value').value = suitePrice(suite) || ''; document.querySelector('#single-price-dialog').showModal(); });
  }

  const aggregate = pairs => Object.values(pairs.reduce((result, [name, quantity, uid]) => {
    const key = String(uid || name);
    result[key] = result[key] || { name, uid: Number(uid) || 0, quantity: 0 };
    result[key].quantity += Number(quantity || 0);
    return result;
  }, {})).sort((left, right) => (left.uid || Number.MAX_SAFE_INTEGER) - (right.uid || Number.MAX_SAFE_INTEGER) || left.name.localeCompare(right.name, 'zh-CN'));
  const materialUnitPrice = material => {
    if (!material) return 0;
    const direct = directSourceChoice(material);
    return direct.price || material.mp || 0;
  };
  const costTable = (rows, totalLabel, total, options = {}) => {
    const priced = rows.map(entry => {
      const choice = options.submarine ? (entry.sourceChoice || submarineSourceChoice(data.m.find(material => String(material.uid) === String(entry.uid)) || { uid: String(entry.uid) })) : null;
      return { ...entry, missing: !entry.cost && entry.quantity > 0, npc: choice?.key === 'npc' ? npcMaterial(entry.uid) : undefined, sourceChoice: choice };
    });
    // 金币显示按整数取整。完整展示时将舍入尾差附加到最后一行，保证用户看到的行合价之和等于表尾总价。
    if (options.reconcile !== false && options.npcSection !== false && priced.length) {
      const displayedTotal = Math.round(total || 0);
      const displayedRows = priced.reduce((sum, entry) => sum + Math.round(entry.cost || 0), 0);
      const target = priced.filter(entry => !entry.missing).at(-1);
      if (target) target.displayCost = Math.max(0, Math.round(target.cost || 0) + displayedTotal - displayedRows);
    }
    priced.forEach(entry => {
      entry.displayCost = entry.displayCost ?? Math.round(entry.cost || 0);
      entry.unit = entry.quantity ? entry.displayCost / entry.quantity : 0;
    });
    const sourceSections = options.sourceSections ?? options.npcSection;
    const npcHeader = sourceSections && priced.some(entry => entry.pinnedNpc) ? '<tr class="detail-section"><td colspan="4">NPC 固定价材料</td></tr>' : '';
    const exchangeHeader = sourceSections && priced.some(entry => entry.pinnedExchange) ? '<tr class="detail-section exchange-section"><td colspan="4">兑换推荐材料</td></tr>' : '';
    const marketHeader = sourceSections && priced.some(entry => entry.pinnedMarket) ? '<tr class="detail-section market-section"><td colspan="4">市场采购材料</td></tr>' : '';
    const regularHeader = sourceSections && priced.some(entry => !entry.pinnedNpc && !entry.pinnedExchange && !entry.pinnedMarket) ? '<tr class="detail-section"><td colspan="4">其余材料</td></tr>' : '';
    const rowHtml = entry => {
      const hasRecipe = Boolean(submarineRawRecipe(entry.uid));
      const isTerminal = entry.sourceChoice?.key && entry.sourceChoice.key !== 'craft' && entry.sourceChoice.key !== 'pending';
      const sourceTag = options.submarine && (entry.sourceChoice?.key === 'npc' || isExchangeChoice(entry.sourceChoice) || (hasRecipe && isTerminal)) ? recommendationTag(entry.sourceChoice) : '';
      const sourceMeta = entry.npc ? `<small class="meta"> · ${entry.npc.source}</small>` : '';
      const reference = options.submarine && hasRecipe && isTerminal ? `<button class="section-toggle" data-sub-recipe-reference="${entry.uid}">查看制作配方</button>` : '';
      return `<tr class="${entry.npc ? 'npc-row' : ''}"><td class="label">${sourceTag}${entry.name}${sourceMeta}${reference}</td><td>${entry.quantity}</td><td>${entry.missing ? '未获取' : money(entry.unit)}</td><td>${entry.missing ? '—' : money(entry.displayCost)}</td></tr>`;
    };
    const npcRows = priced.filter(entry => entry.pinnedNpc).map(rowHtml).join('');
    const exchangeRows = priced.filter(entry => !entry.pinnedNpc && entry.pinnedExchange).map(rowHtml).join('');
    const marketRows = priced.filter(entry => !entry.pinnedNpc && !entry.pinnedExchange && entry.pinnedMarket).map(rowHtml).join('');
    const regularRows = priced.filter(entry => !entry.pinnedNpc && !entry.pinnedExchange && !entry.pinnedMarket).map(rowHtml).join('');
    const body = priced.length
      ? (sourceSections ? `${npcHeader}${npcRows}${exchangeHeader}${exchangeRows}${marketHeader}${marketRows}${regularHeader}${regularRows}` : priced.map(rowHtml).join(''))
      : '<tr><td colspan="4" class="empty">暂无数据</td></tr>';
    return `<div class="table-wrap history-table"><table class="ledger"><thead><tr><th>材料 / 成品</th><th>数量</th><th>单价</th><th>合价</th></tr></thead><tbody>${body}</tbody><tfoot><tr><th colspan="3">${totalLabel}</th><th>${money(total)}</th></tr></tfoot></table></div>`;
  };
  function openBundleDetail(bundle) {
    const plan = productionPlan(bundle);
    const history = data.l.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.type === '出售' && entry.bundleId === bundle.id);
    document.querySelector('#bundle-detail-meta').textContent = `装备售卖 > ${bundle.group} > ${bundle.label}`;
    document.querySelector('#bundle-detail-title').textContent = `${bundle.label}装备详情`;
    const incomplete = bundle.components.filter(component => component.item && !hasCompleteBaseRecipe(component.item)).map(component => component.item.n);
    const missingPrices = plan.missing;
    document.querySelector('#bundle-detail-content').innerHTML = `${incomplete.length ? `<div class="status">基础配方不完整：${incomplete.join('、')}。该套装不可制作入账。</div>` : ''}${missingPrices.length ? `<div class="status">以下基础素材未获取单价：${missingPrices.join('、')}。请刷新市场价或添加采购记录后再制作。</div>` : ''}<div class="detail-columns"><section class="detail-column"><h3>成品清单</h3>${costTable(plan.finished, '成品清单总成本', plan.total)}</section><section class="detail-column"><h3>制作素材：直接</h3>${costTable(plan.direct, '直接素材总成本', plan.total)}</section><section class="detail-column"><h3>制作素材：基础</h3>${costTable(plan.basic, '基础素材总成本', plan.total)}</section></div><section class="sales-history"><div class="history-head"><div><h3>历史销售记录</h3><div class="sub">新增与删除记录都会同步回写该职业 / 分项的成品库存。</div></div></div><form id="detail-sale-form" class="history-form"><label>销售日期<input id="detail-sale-date" type="date" value="${today()}"></label><label>数量<input id="detail-sale-quantity" type="number" min="1" max="${inventory(bundle)}" value="1"></label><label>成交单价<input id="detail-sale-price" type="number" min="0" value="${priceFor(bundle)}"></label><button class="btn" ${inventory(bundle) ? '' : 'disabled'}>+ 新增销售记录</button></form><div class="table-wrap history-table"><table class="ledger"><thead><tr><th>日期</th><th>数量</th><th>成交额</th><th>销售成本</th><th>利润</th><th></th></tr></thead><tbody>${history.map(({ entry, index }) => `<tr><td>${entry.date}</td><td>${entry.q}</td><td>${money(entry.amount)}</td><td>${money(entry.cost)}</td><td class="profit">${money(entry.profit)}</td><td><button class="btn secondary" data-delete-sale="${index}">删除</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">暂无销售记录</td></tr>'}</tbody></table></div></section>`;
    document.querySelector('#detail-sale-form').onsubmit = event => {
      event.preventDefault();
      try {
        sell(bundle, Number(document.querySelector('#detail-sale-price').value || 0), document.querySelector('#detail-sale-date').value || today(), Number(document.querySelector('#detail-sale-quantity').value || 1));
        save(); refreshBundleDetail(bundle);
      } catch (error) { alert(error.message || '新增销售记录失败。'); }
    };
    document.querySelectorAll('[data-delete-sale]').forEach(button => button.onclick = () => {
      const log = data.l[Number(button.dataset.deleteSale)];
      if (!log || log.bundleId !== bundle.id) return;
      restoreSaleLog(log); data.l.splice(Number(button.dataset.deleteSale), 1); save(); refreshBundleDetail(bundle);
    });
    if (!document.querySelector('#bundle-detail-dialog').open) document.querySelector('#bundle-detail-dialog').showModal();
  }
  const estimateBundleCost = bundle => unitCost(bundle);
  const refreshBundleDetail = bundle => {
    document.querySelector('#bundle-detail-dialog').close();
    render();
    openBundleDetail(bundle);
  };

  function craftPlan(bundle) {
    const plan = productionPlan(bundle);
    if (plan.missing.length) throw new Error('缺少成本：' + plan.missing.join('、'));
    const recipeCosts = plan.finished.map(row => {
      const item = bundle.components.find(component => component.item && Number(component.item.itemId) === row.uid)?.item;
      if (!item) throw new Error('套装中存在未匹配的成品配方。');
      return { id: item.id, qty: row.quantity, cost: row.cost };
    });
    return { recipeCosts, cost: plan.total };
  }
  function craft(bundle) {
    const plan = craftPlan(bundle);
    plan.recipeCosts.forEach(entry => {
      const value = stock(entry.id);
      value.q += entry.qty; value.v += entry.cost; value.made = (value.made || 0) + entry.qty;
      data.p[entry.id] = value;
    });
    data.l.unshift({ date: today(), type: '制作', item: bundle.label, q: 1, amount: plan.cost, cost: plan.cost, autoKind: 'craft', bundleId: bundle.id, recipeCosts: plan.recipeCosts });
  }
  function undoCraft(bundle) {
    const logIndex = data.l.findIndex(entry => isCraftLog(entry) && (entry.bundleId === bundle.id || (entry.legacyMigration && entry.recipeCosts?.some(cost => bundle.components.some(component => component.item?.id === cost.id)))));
    if (logIndex < 0) throw new Error('没有可撤销的自动制作记录。');
    const log = data.l[logIndex];
    if (log.recipeCosts.some(entry => stock(entry.id).q < (entry.qty || 1))) throw new Error('已有成品售出，不能撤销这次制作。');
    log.recipeCosts.forEach(entry => {
      const value = stock(entry.id);
      const entryQty = entry.qty || 1;
      value.q -= entryQty; value.v -= entry.cost; value.made = Math.max(0, (value.made || 0) - entryQty);
      data.p[entry.id] = value;
    });
    data.l.splice(logIndex, 1);
  }
  function sell(bundle, customPrice, saleDate = today(), quantity = 1) {
    quantity = Math.max(1, Number(quantity) || 1);
    if (inventory(bundle) < quantity) throw new Error('库存不足，不能售卖。');
    const recipeCosts = bundle.components.map(component => {
      const value = stock(component.item.id), componentQty = component.qty * quantity;
      return { id: component.item.id, qty: componentQty, cost: value.v / value.q * componentQty };
    });
    const cost = recipeCosts.reduce((sum, entry) => sum + entry.cost, 0), amount = (customPrice ?? priceFor(bundle)) * quantity;
    recipeCosts.forEach(entry => {
      const value = stock(entry.id);
      value.q -= entry.qty; value.v -= entry.cost; value.sold = (value.sold || 0) + entry.qty;
      data.p[entry.id] = value;
    });
    data.l.unshift({ date: saleDate, type: '出售', item: bundle.label, q: quantity, amount, cost, profit: amount - cost, autoKind: customPrice == null ? 'sale' : 'custom-sale', bundleId: bundle.id, recipeCosts });
  }
  function restoreSaleLog(log) {
    (log.recipeCosts || []).forEach(entry => {
      const value = stock(entry.id);
      const entryQty = entry.qty || Number(log.q) || 1;
      value.q += entryQty; value.v += entry.cost; value.sold = Math.max(0, (value.sold || 0) - entryQty);
      data.p[entry.id] = value;
    });
  }
  function undoSale(bundle) {
    const logIndex = data.l.findIndex(entry => entry.autoKind === 'sale' && entry.bundleId === bundle.id);
    if (logIndex < 0) throw new Error('没有可撤销的自动售卖记录。');
    const log = data.l[logIndex];
    restoreSaleLog(log);
    data.l.splice(logIndex, 1);
  }
  function openAutoSaleConfirm(bundle) {
    state.pendingAutoSale = bundle.id;
    const price = priceFor(bundle), cost = unitCost(bundle);
    document.querySelector('#auto-sale-summary').innerHTML = `<b>${bundle.label}</b><div class="meta" style="margin-top:8px">按当前套装价售卖 1 套</div><div style="margin-top:10px">售价 ${money(price)} · 成本 ${money(cost)} · 预计利润 ${money(price - cost)} · 当前库存 ${inventory(bundle)}</div>`;
    document.querySelector('#auto-sale-dialog').showModal();
  }
  function changeBundle(action, bundle) {
    try {
      if (action === 'craft-plus') craft(bundle);
      if (action === 'craft-minus') undoCraft(bundle);
      if (action === 'sale-plus') return openAutoSaleConfirm(bundle);
      if (action === 'sale-minus') undoSale(bundle);
      save(); render();
    } catch (error) { alert(error.message || '操作失败。'); }
  }
  function editPrice(bundle) {
    state.editingPriceKey = bundle.priceKey;
    document.querySelector('#single-price-title').textContent = '调整' + bundle.label + '价格';
    document.querySelector('#single-price-value').value = priceFor(bundle) || '';
    document.querySelector('#single-price-dialog').showModal();
  }
  function openPriceTemplate() {
    const rows = ledgerRows(state.type);
    const current = part => priceFor(rows.find(item => item.pricePart === part) || { priceKey: '' });
    const combat = state.type === '770';
    document.querySelector('#price-template-title').textContent = combat ? '统一调整战职套装价格' : '统一调整生产采集套装价格';
    document.querySelector('#price-total-label').firstChild.textContent = combat ? '套装总价（含武器）' : '套装总价（含主副手）';
    document.querySelector('#price-weapon-label').firstChild.textContent = combat ? '武器价格' : '主副手价格';
    document.querySelector('#price-template-total').value = current('total') || '';
    document.querySelector('#price-template-armor').value = current('armor') || '';
    document.querySelector('#price-template-accessory').value = current('accessory') || '';
    document.querySelector('#price-template-weapon').value = prices[`${state.type}-template-weapon`] || '';
    document.querySelector('#price-template-dialog').showModal();
  }
  document.querySelector('#price-template-form').onsubmit = event => {
    event.preventDefault();
    const values = {
      total: Math.max(0, Number(document.querySelector('#price-template-total').value || 0)),
      armor: Math.max(0, Number(document.querySelector('#price-template-armor').value || 0)),
      accessory: Math.max(0, Number(document.querySelector('#price-template-accessory').value || 0)),
      weapon: Math.max(0, Number(document.querySelector('#price-template-weapon').value || 0))
    };
    ledgerRows(state.type).forEach(item => {
      if (item.pricePart === 'gear') delete prices[item.priceKey];
      else prices[item.priceKey] = values[item.pricePart] || 0;
    });
    prices[`${state.type}-template-weapon`] = values.weapon;
    save(); document.querySelector('#price-template-dialog').close(); renderEquipment();
  };
  function openCustomSale() {
    const rows = ledgerRows(state.type);
    const select = document.querySelector('#custom-row');
    select.innerHTML = rows.map(item => `<option value="${item.id}">${item.group} · ${item.label}（库存 ${inventory(item)}）</option>`).join('');
    const update = () => {
      const active = rows.find(item => item.id === select.value);
      document.querySelector('#custom-price').value = priceFor(active);
    };
    select.onchange = update; update();
    document.querySelector('#custom-sale').showModal();
  }
  document.querySelector('#custom-sale-form').onsubmit = event => {
    event.preventDefault();
    const bundle = ledgerRows(state.type).find(item => item.id === document.querySelector('#custom-row').value);
    try { sell(bundle, Number(document.querySelector('#custom-price').value || 0)); save(); document.querySelector('#custom-sale').close(); render(); } catch (error) { alert(error.message || '操作失败。'); }
  };
  document.querySelector('#auto-sale-form').onsubmit = event => {
    event.preventDefault();
    const bundle = ledgerRows(state.type).find(item => item.id === state.pendingAutoSale);
    try {
      if (!bundle) throw new Error('未找到待售套装。');
      sell(bundle); save(); document.querySelector('#auto-sale-dialog').close(); state.pendingAutoSale = null; render();
    } catch (error) { alert(error.message || '售卖失败。'); }
  };
  document.querySelector('#single-price-form').onsubmit = event => {
    event.preventDefault();
    if (!state.editingPriceKey) return;
    prices[state.editingPriceKey] = Math.max(0, Number(document.querySelector('#single-price-value').value || 0));
    save(); document.querySelector('#single-price-dialog').close();
    if (state.page === 'submarine') renderSubmarine(); else renderEquipment();
  };
  document.querySelector('#submarine-sale-form').onsubmit = event => {
    event.preventDefault();
    const part = submarineData.parts.find(item => Number(item.id) === Number(state.pendingSubmarineSale));
    try { if (!part) throw new Error('未找到待售潜水艇部件。'); submarineSell(part, Number(document.querySelector('#submarine-sale-price').value || 0), today(), Number(document.querySelector('#submarine-sale-quantity').value || 1)); save(); document.querySelector('#submarine-sale-dialog').close(); state.pendingSubmarineSale = null; renderSubmarine(); }
    catch (error) { alert(error.message || '售卖失败。'); }
  };
  document.querySelector('#submarine-suite-sale-form').onsubmit = event => {
    event.preventDefault();
    const suite = submarineSuites.find(item => item.id === state.pendingSubmarineSuite);
    try { if (!suite) throw new Error('未找到待售潜水艇整套。'); submarineSellSuite(suite, Number(document.querySelector('#submarine-suite-sale-price').value || 0), today(), Number(document.querySelector('#submarine-suite-sale-quantity').value || 1)); save(); document.querySelector('#submarine-suite-sale-dialog').close(); state.pendingSubmarineSuite = null; renderSubmarine(); }
    catch (error) { alert(error.message || '整套售卖失败。'); }
  };
  document.querySelector('#submarine-craft-form').onsubmit = event => {
    event.preventDefault();
    const pending = state.pendingSubmarineCraft, quantity = Number(document.querySelector('#submarine-craft-quantity').value || 1);
    try {
      if (!pending) throw new Error('未找到待制作项目。');
      if (pending.isSuite) submarineCraftSuite(submarineSuites.find(item => item.id === pending.id), quantity);
      else submarineCraft(submarineData.parts.find(item => Number(item.id) === Number(pending.id)), quantity);
      save(); document.querySelector('#submarine-craft-dialog').close(); state.pendingSubmarineCraft = null; renderSubmarine();
    } catch (error) { alert(error.message || '制作失败。'); }
  };
  document.querySelector('#report-reconcile-kind').onchange = updateReconcileTargets;
  document.querySelector('#report-reconcile-form').onsubmit = event => {
    event.preventDefault();
    const entry = findReportSale(state.pendingReportKey), kind = document.querySelector('#report-reconcile-kind').value, targetId = document.querySelector('#report-reconcile-target').value;
    try {
      if (!entry || !targetId) throw new Error('未找到待补全的销售记录或归属项目。');
      const patch = {
        date: document.querySelector('#report-reconcile-date').value || today(),
        item: document.querySelector('#report-reconcile-item').value.trim(),
        amount: Number(document.querySelector('#report-reconcile-amount').value || 0),
        cost: Number(document.querySelector('#report-reconcile-cost').value || 0),
        profit: Number(document.querySelector('#report-reconcile-profit').value || 0)
      };
      if (!patch.item) throw new Error('请填写销售记录名称。');
      reconcileReportSale(entry, kind, targetId, patch); save(); document.querySelector('#report-reconcile-dialog').close(); state.pendingReportKey = null;
      openOverviewSales(state.overviewPeriod, state.overviewSelectedMonth); renderHome();
    } catch (error) { alert(error.message || '补全来源失败。'); }
  };
  document.querySelector('#submarine-suite-form').onsubmit = event => {
    event.preventDefault();
    const code = document.querySelector('#submarine-suite-code').value.trim();
    const modified = document.querySelector('#submarine-suite-modified').checked;
    if (!/^[0-5]{4}$/.test(code) || !/[1-5]/.test(code)) return alert('套装简称必须为四位 0–5 数字，且至少包含一个部件。');
    const existing = submarineSuites.find(item => item.id === state.editingSubmarineSuite);
    const id = existing?.id || ('suite-' + Date.now());
    const suite = { id, code, modified, label: code + (modified ? '改' : ''), priceKey: existing?.priceKey || ('submarine-suite-' + id) };
    if (existing) Object.assign(existing, suite); else submarineSuites.push(suite);
    prices[suite.priceKey] = Math.max(0, Number(document.querySelector('#submarine-suite-price').value || 0));
    save(); document.querySelector('#submarine-suite-dialog').close(); renderSubmarine();
  };
  document.querySelector('#npc-material-form').onsubmit = event => {
    event.preventDefault();
    const uid = String(document.querySelector('#npc-material-id').value || '');
    const name = document.querySelector('#npc-material-name').value || materialName(uid);
    const price = Number(document.querySelector('#npc-material-price').value || 0);
    const source = document.querySelector('#npc-material-source').value.trim();
    if (!submarineCatalogIds().has(uid) || !price || !source) return alert('请选择潜水艇推荐材料名录内的材料，并填写 NPC 采购价和购买来源。');
    npcMaterialConfig.added = npcMaterialConfig.added || {};
    npcMaterialConfig.added[uid] = { name, price, source, manual: true };
    npcMaterialConfig.disabled = (npcMaterialConfig.disabled || []).filter(value => String(value) !== uid);
    invalidateNpcMaterials(); ensureSubmarineMaterials(); syncPurchaseCosts(); save();
    document.querySelector('#npc-material-price').value = '';
    document.querySelector('#npc-material-source').value = '';
    document.querySelector('#npc-material-search').value = '';
    openNpcMaterialManager(); renderGuide();
  };
  document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => document.querySelector('#' + button.dataset.close).close());
  document.querySelectorAll('dialog').forEach(dialog => dialog.onclick = event => {
    if (event.target === dialog) dialog.close();
  });
  const purchaseQuantity = document.querySelector('#purchase-quantity');
  const purchaseTax = document.querySelector('#purchase-tax');
  const purchaseUnit = document.querySelector('#purchase-unit');
  const purchaseTotal = document.querySelector('#purchase-total');
  const syncPurchaseForm = () => {
    const quantity = Number(purchaseQuantity.value || 0), tax = Number(purchaseTax.value || 0);
    if (!quantity) return;
    if (state.purchaseEditMode === 'total') {
      purchaseUnit.value = (Number(purchaseTotal.value || 0) / quantity / (1 + tax)).toFixed(2);
    } else {
      purchaseTotal.value = (quantity * Number(purchaseUnit.value || 0) * (1 + tax)).toFixed(2);
    }
  };
  purchaseUnit.oninput = () => { state.purchaseEditMode = 'unit'; syncPurchaseForm(); };
  purchaseTotal.oninput = () => { state.purchaseEditMode = 'total'; syncPurchaseForm(); };
  purchaseQuantity.oninput = syncPurchaseForm;
  purchaseTax.onchange = syncPurchaseForm;
  document.querySelector('#purchase-form').onsubmit = event => {
    event.preventDefault();
    const material = data.m.find(item => item.id === state.selectedMaterial);
    const mode = document.querySelector('#purchase-kind').value;
    let entry;
    if (mode.startsWith('exchange:')) {
      const routeIndex = Number(mode.slice(9)), route = exchangeSources.routes?.[routeIndex];
      const turns = Math.max(0, Number(document.querySelector('#purchase-exchange-turns').value || 0));
      const sourceUnitPrice = Math.max(0, Number(document.querySelector('#purchase-source-price').value || 0));
      const outputPerTurn = Number(route?.outputs?.[String(material?.uid)] || 0);
      const sourceQuantity = route?.carrierId ? turns : turns * Number(route?.ticketCost || 0);
      const quantity = turns * outputPerTurn, total = sourceQuantity * sourceUnitPrice;
      if (!material || !route || !turns || !quantity || !total) return alert('请填写有效的兑换次数和凭证单价。');
      entry = {
        id: state.editingPurchaseId || 'exchange-' + Date.now(), kind: 'exchange', materialId: material.id,
        date: document.querySelector('#purchase-date').value || today(), quantity, unitPrice: total / quantity, total, tax: 0,
        exchangeRoute: routeIndex, exchangeSource: route.label, exchangeOutputUid: String(material.uid),
        exchangeTurns: turns, exchangeSourceUnitPrice: sourceUnitPrice, exchangeSourceQuantity: sourceQuantity
      };
    } else {
      const quantity = Number(purchaseQuantity.value || 0), tax = Number(purchaseTax.value || 0), unitPrice = Number(purchaseUnit.value || 0), total = Number(purchaseTotal.value || 0);
      if (!material || !quantity || !total) return alert('请填写购买数量和单价或合价。');
      entry = { id: state.editingPurchaseId || 'purchase-' + Date.now(), materialId: material.id, date: document.querySelector('#purchase-date').value || today(), quantity, unitPrice, total, tax };
    }
    const index = purchases.findIndex(row => row.id === state.editingPurchaseId);
    if (index >= 0) purchases[index] = entry;
    else purchases.unshift(entry);
    refreshNpcRecommendations(); save(); document.querySelector('#purchase-dialog').close();
    if (document.querySelector('#purchase-manager-dialog').open) { renderPurchaseManager(); renderGuide(); }
    else if (state.guideView === 'detail') renderPurchaseDetail();
    else renderGuide();
  };
  document.querySelectorAll('nav button[data-page]').forEach(button => button.onclick = () => {
    state.page = button.dataset.page; state.expanded = false; state.guideExpanded = false; state.submarineExpanded = false; render();
  });
  document.querySelector('#equipment-toggle').onclick = () => { state.page = 'equipment'; state.type = null; state.expanded = true; state.submarineExpanded = false; state.guideExpanded = false; render(); };
  document.querySelectorAll('[data-type]').forEach(button => button.onclick = () => {
    state.page = 'equipment'; state.type = button.dataset.type; state.expanded = true; state.submarineExpanded = false; state.guideExpanded = false; render();
  });
  document.querySelector('#submarine-toggle').onclick = () => { const wasOnSubmarine = state.page === 'submarine'; state.page = 'submarine'; state.submarineView = 'summary'; state.submarineExpanded = wasOnSubmarine ? !state.submarineExpanded : true; state.expanded = false; state.guideExpanded = false; render(); };
  document.querySelectorAll('[data-submarine-view]').forEach(button => button.onclick = () => { state.page = 'submarine'; state.submarineView = button.dataset.submarineView; state.submarineExpanded = true; state.expanded = false; state.guideExpanded = false; render(); });
  document.querySelector('#guide-toggle').onclick = () => { state.guideExpanded = !state.guideExpanded; render(); };
  document.querySelectorAll('[data-guide]').forEach(button => button.onclick = () => {
    state.page = 'guide'; state.guideView = button.dataset.guide; state.selectedMaterial = null; state.guideExpanded = true; state.expanded = false; state.submarineExpanded = false; render();
  });
  function render() {
    document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === state.page));
    document.querySelectorAll('nav button[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === state.page));
    document.querySelector('#equipment-toggle').classList.toggle('active', state.page === 'equipment' || state.expanded);
    document.querySelector('#equipment-toggle').setAttribute('aria-expanded', String(state.expanded));
    document.querySelector('#equipment-toggle .nav-caret').textContent = state.expanded ? '⌃' : '⌄';
    document.querySelector('#equipment-subnav').classList.toggle('open', state.expanded);
    document.querySelectorAll('[data-type]').forEach(button => button.classList.toggle('active', state.page === 'equipment' && button.dataset.type === state.type));
    document.querySelector('#submarine-toggle').classList.toggle('active', state.page === 'submarine' || state.submarineExpanded);
    document.querySelector('#submarine-toggle').setAttribute('aria-expanded', String(state.submarineExpanded));
    document.querySelector('#submarine-toggle .nav-caret').textContent = state.submarineExpanded ? '⌃' : '⌄';
    document.querySelector('#submarine-subnav').classList.toggle('open', state.submarineExpanded);
    document.querySelectorAll('[data-submarine-view]').forEach(button => button.classList.toggle('active', state.page === 'submarine' && button.dataset.submarineView === state.submarineView));
    document.querySelector('#guide-toggle').classList.toggle('active', state.page === 'guide' || state.guideExpanded);
    document.querySelector('#guide-toggle').setAttribute('aria-expanded', String(state.guideExpanded));
    document.querySelector('#guide-toggle .nav-caret').textContent = state.guideExpanded ? '⌃' : '⌄';
    document.querySelector('#guide-subnav').classList.toggle('open', state.guideExpanded);
    document.querySelectorAll('[data-guide]').forEach(button => button.classList.toggle('active', state.page === 'guide' && button.dataset.guide === state.guideView));
    if (state.page === 'home') renderHome();
    else if (state.page === 'equipment') renderEquipment();
    else if (state.page === 'submarine') renderSubmarine();
    else if (state.page === 'guide') renderGuide();
  }
  if (migrateLegacyInventories()) save();
  render();
  setInterval(() => {
    if (state.page === 'guide' && state.guideView !== 'detail') refreshMarket(false, visibleGuideMarketMaterials());
  }, 3 * 60 * 60 * 1000);
});
