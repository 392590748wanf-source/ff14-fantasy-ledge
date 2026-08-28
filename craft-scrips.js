// 能工巧匠工票资料。仅描述兑换与收藏品回报，不把工票换算为金币价格。
// 后续版本可只更新此文件并重建 data 数据包。
const craftScripData = window.FF14_CRAFT_SCRIP_DATA || { items: {}, recipes: {}, audit: {} };
const craftScripRewards = {
  90: { ratings: [396, 540, 684], payouts: [95, 104, 114] },
  91: { ratings: [451, 615, 779], payouts: [107, 117, 128] },
  93: { ratings: [495, 675, 855], payouts: [119, 130, 142] },
  95: { ratings: [539, 735, 931], payouts: [131, 144, 157] },
  97: { ratings: [583, 795, 1007], payouts: [143, 157, 171] },
  99: { ratings: [627, 855, 1083], payouts: [165, 181, 198] },
  100: { ratings: [660, 900, 1140], payouts: [120, 134, 144] }
};
const craftScripCatalog = [
  ['36619','收藏用完满木钓竿','刻木匠',90],['44185','收藏用五加木耳坠','刻木匠',91],['44186','收藏用木棉木长枪','刻木匠',93],['44187','收藏用深红木项链','刻木匠',95],['44188','收藏用相思木法杖','刻木匠',97],['44189','收藏用克拉洛胡桃木砂轮机','刻木匠',99],['44190','收藏用克拉洛胡桃木钓竿','刻木匠',100],
  ['36620','收藏用球粒陨石工艺锤','锻铁匠',90],['44191','收藏用奥阔铬铁拳套','锻铁匠',91],['44192','收藏用钌金战斧','锻铁匠',93],['44193','收藏用钴钨弯刀','锻铁匠',95],['44194','收藏用钛金研钵','锻铁匠',97],['44195','收藏用卡扎纳尔战镰','锻铁匠',99],['44196','收藏用卡扎纳尔圆革刀','锻铁匠',100],
  ['36621','收藏用球粒陨石蒸馏器','铸甲匠',90],['44197','收藏用奥阔铬铁蒸馏器','铸甲匠',91],['44198','收藏用钌金铠靴','铸甲匠',93],['44199','收藏用钴钨陆行鸟煎锅','铸甲匠',95],['44200','收藏用钛金钉刺护甲','铸甲匠',97],['44201','收藏用卡扎纳尔胫甲','铸甲匠',99],['44202','收藏用卡扎纳尔指环','铸甲匠',100],
  ['36622','收藏用球粒陨石缝针','雕金匠',90],['44203','收藏用混金长弓','雕金匠',91],['44204','收藏用河岸石头冠','雕金匠',93],['44205','收藏用钴钨刺剑','雕金匠',95],['44206','收藏用白黄金项环','雕金匠',97],['44207','收藏用卡扎纳尔太阳仪','雕金匠',99],['44208','收藏用黑星石耳坠','雕金匠',100],
  ['36623','收藏用蛇牛革半手套','制革匠',90],['44209','收藏用银狼革半指护手','制革匠',91],['44210','收藏用锤头鳄革护腿','制革匠',93],['44211','收藏用狞豹革护臂','制革匠',95],['44212','收藏用嵌齿象革衬裤','制革匠',97],['44213','收藏用卡冈图亚革软甲裤','制革匠',99],['44214','收藏用卡冈图亚革工作帽','制革匠',100],
  ['36624','收藏用迷彩绒工作帽','裁衣匠',90],['44215','收藏用雪木棉贝雷帽','裁衣匠',91],['44216','收藏用高山亚麻上装','裁衣匠',93],['44217','收藏用薄绢腿套','裁衣匠',95],['44218','收藏用犎牛哔叽工作帽','裁衣匠',97],['44219','收藏用落雷绢手套','裁衣匠',99],['44220','收藏用落雷绢宽松七分裤','裁衣匠',100],
  ['36625','收藏用蛇牛革魔导典','炼金术士',90],['44221','收藏用银狼革魔导书','炼金术士',91],['44222','收藏用巧力之宝水','炼金术士',93],['44223','收藏用狞豹革魔导典','炼金术士',95],['44224','收藏用魔匠药液','炼金术士',97],['44225','收藏用耐力之宝药','炼金术士',99],['44226','收藏用克拉洛胡桃木平笔','炼金术士',100],
  ['36626','收藏用无花果冻糕','烹调师',90],['44227','收藏用炖煮羊驼肉排','烹调师',91],['44228','收藏用香蕉星磅蛋糕','烹调师',93],['44229','收藏用图拉尔菠萝蛋糕','烹调师',95],['44230','收藏用鲑鱼干','烹调师',97],['44231','收藏用酿柿子椒','烹调师',99],['44232','收藏用烤牛肉夹饼','烹调师',100]
];
const collectables = craftScripCatalog.map(([itemId, name, job, level]) => {
  const rewards = craftScripRewards[level];
  return { itemId, name, job, level, ticket: level === 100 ? 'orange' : 'purple', scope: 'regular', active: true,
    // 收藏品不能交易；其制作素材仍可使用市场价计算工票成本。
    marketExcluded: true, marketExcludedReason: 'collectable',
    ratings: rewards.ratings, payouts: rewards.payouts, maxPayout: rewards.payouts.at(-1),
    outputQuantity: craftScripData.recipes?.[itemId]?.[0]?.y || 1,
    recipeSource: 'Garland Tools 国服配方', verified: Boolean(craftScripData.audit?.[itemId]?.verified) };
});

window.FF14_CRAFT_SCRIPS = {
  schema: 2,
  version: '0.0.6',
  publishedAt: '2026-08-29T00:00:00.000Z',
  sources: {
    huijiCollectables: 'https://ff14.huijiwiki.com/wiki/%E6%94%B6%E8%97%8F%E5%93%81',
    orange: 'https://ff14.huijiwiki.com/wiki/%E5%B7%A7%E6%89%8B%E6%A9%99%E7%A5%A8',
    purple: 'https://ff14.huijiwiki.com/wiki/%E5%B7%A7%E6%89%8B%E7%B4%AB%E7%A5%A8',
    garland: 'https://www.garlandtools.cn/db/'
  },
  tickets: {
    orange: { label: '巧手橙票', accent: 'orange', minimumCollectableLevel: 100, scope: '100 级常规收藏品' },
    purple: { label: '巧手紫票', accent: 'purple', minimumCollectableLevel: 90, scope: '90 级及以上常规收藏品' }
  },
  exchanges: [
    {
      itemId: '44848', ticket: 'orange', ticketCost: 125, outputQuantity: 1,
      source: '巧手橙票兑换（100级或更高·素材·房屋相关）',
      sourceUrl: 'https://ff14.huijiwiki.com/wiki/%E7%89%A9%E5%93%81%3A%E9%AB%98%E6%B5%93%E7%BC%A9%E7%82%BC%E9%87%91%E8%8D%AF',
      scope: '当前 770／750 装备配方实际引用时才进入装备推荐材料', verified: true
    },
    {
      itemId: '46252', ticket: 'purple', ticketCost: 500, outputQuantity: 1,
      source: '巧手紫票兑换（90级或更高·素材）',
      sourceUrl: 'https://ff14.huijiwiki.com/wiki/%E7%89%A9%E5%93%81%3A%E7%9F%B3%E5%8C%A0%E7%A0%94%E7%A3%A8%E5%89%82',
      scope: '当前 770／750 装备配方实际引用时才进入装备推荐材料', verified: true
    }
  ],
  items: craftScripData.items || {},
  recipes: craftScripData.recipes || {},
  collectables,
  audit: {
    sourceVersion: 'Huiji 收藏品名录 / Garland Tools 国服配方核验',
    status: Object.keys(craftScripData.recipes || {}).length ? 'Garland Tools 配方已同步' : '等待 Garland Tools 配方同步',
    note: '八职业共 56 项常规收藏品。90–99 级使用巧手紫票，100 级使用巧手橙票；缺少可核验配方或材料价格时不会参与最低成本推荐。',
    verification: craftScripData.audit || {}
  }
};
