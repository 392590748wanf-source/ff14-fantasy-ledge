// 捕鱼人理符推荐路线。任务、经验、交付物与接取地点由 XIVAPI / Garland / 灰机 Wiki 交叉核验；
// normal / double 的物品数量以用户提供的无优待／优待方案表为准。捕鱼人按普通品质交付。
window.FF14_FISHER_LEVES={
  schema:1,
  version:'0.0.1',
  jobs:['捕鱼人'],
  audit:{status:'已核验',source:'XIVAPI、Garland Tools、灰机 Wiki；方案数量按用户提供的捕鱼人优待表。'},
  routes:[
    [767,15,'指定采集：不够的折刀贝','折刀贝',4884,29030,'小麦酒港','2.0','重生之境',98039,3,9,3],
    [768,15,'大量采集：面向土特产店的白珊瑚','白珊瑚',5460,29062,'小麦酒港','2.0','重生之境',58824,3,9,6],
    [769,15,'大量采集：用于炼金材料的钢盔鲎','钢盔鲎',4880,29032,'小麦酒港','2.0','重生之境',58824,3,9,6],
    [778,30,'指定采集：小猫咪的烤串材料','灰海金枪鱼',4896,29018,'太阳海岸','2.0','重生之境',344153,3,18,9],
    [779,30,'指定采集：醋鲱鱼','苍茫鲱',4895,29010,'太阳海岸','2.0','重生之境',344153,3,18,3],
    [780,30,'大量采集：酒宴用的黑鳎','黑鳎',4892,29014,'太阳海岸','2.0','重生之境',206492,3,45,24],
    [1209,50,'指定采集：放养用蓝螯虾','蓝螯虾',12722,29404,'伊修加德基础层','3.0','苍穹之禁城',963302,3,12,6],
    [1222,54,'大量采集：渲染战旗的蓝','蓝天珊瑚',12736,29061,'伊修加德基础层','3.0','苍穹之禁城',649855,3,27,15],
    [1390,60,'大量采集：用于腌制的高地刺鱼','高地刺鱼',20090,29260,'黄金港','4.0','红莲之狂潮',760696,3,72,36],
    [1554,70,'指定采集：美味的沙卵三明治','沙卵',27462,29617,'水晶都','5.0','暗影之逆焰',1503258,3,24,15],
    [1561,74,'大量采集：美味的鲱鱼拼盘','樱桃鲱鱼',27473,29580,'水晶都','5.0','暗影之逆焰',1089875,3,72,42],
    [1679,80,'指定采集：名医爱用的毒螃蟹','红星蟹',36551,28068,'旧萨雷安','6.0','晓月之终途',2459716,9,45,27],
    [1680,82,'指定采集：近东种群的人工饲养样本','贪食沼虾',36409,28414,'旧萨雷安','6.0','晓月之终途',2464410,3,39,24],
    [1684,86,'指定采集：编纂图鉴所需的未知菌类','不完整菌类987',36471,29764,'旧萨雷安','6.0','晓月之终途',2953920,3,39,21],
    [1798,90,'指定采集：传说中的上古利斧','大理石手斧',43676,29935,'图莱尤拉','7.0','金曦之遗辉',4395018,3,21,21],
    [1800,92,'指定采集：落叶游动的龟占仪式','花褶玛塔蛇颈龟',43692,28572,'图莱尤拉','7.0','金曦之遗辉',5080188,3,18,18],
    [1802,94,'指定采集：讨伐就拜托你了……！','佩鲁灾星',43702,28581,'图莱尤拉','7.0','金曦之遗辉',5803754,3,18,18],
    [1804,96,'指定采集：映射天空的星粒鱼','星粒鱼',43739,28606,'图莱尤拉','7.0','金曦之遗辉',6726582,3,18,18],
    [1806,98,'指定采集：极品夹饼的白肉鱼','黑莓鲈',43769,28618,'图莱尤拉','7.0','金曦之遗辉',7606049,3,18,18]
  ].map(([leveId,level,quest,item,itemId,itemIcon,place,expansion,expansionName,experiencePerSubmission,itemsPerAllowance,normalQuantity,doubleQuantity])=>({
    leveId,job:'捕鱼人',level,quest,item,itemId,itemIcon,place,expansion,expansionName,experiencePerSubmission,
    itemsPerAllowance,submissionsPerAllowance:1,routeAllowances:Math.max(1,normalQuantity/itemsPerAllowance),routeQuantity:normalQuantity,
    systemPlan:{normal:Math.max(1,normalQuantity/itemsPerAllowance),double:Math.max(1,doubleQuantity/itemsPerAllowance)},
    systemQuantity:{normal:normalQuantity,double:doubleQuantity},isSystemRecommended:true,verified:true,verificationStatus:'xivapi-garland-wiki-verified',
    garlandUrl:`https://www.garlandtools.org/db/doc/leve/en/3/${leveId}.json`,wikiUrl:`https://ff14.huijiwiki.com/wiki/Data:Leve/${leveId}.json`,
    verificationNote:'捕鱼人普通品质交付；优待为服务器双倍经验，物品数量按用户提供的路线表核验。'
  }))
};
