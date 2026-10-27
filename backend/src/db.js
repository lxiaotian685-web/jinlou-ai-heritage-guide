import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { reviewedSpotContent } from './reviewed-spots.js';
import { reviewedNarrations } from './reviewed-narrations.js';
import { runDatabaseMigrations } from './migrations.js';
import { reviewedFaqs } from './reviewed-faqs.js';

const seedSpots = [
  {
    id: 'nanshan-hall',
    name: '南山祠',
    summary: '现场景点分布牌1号点位，建筑介绍待景区资料审核。',
    category: '祠堂建筑',
    coverImage: '/images/jinlou-03.jpg',
    hasPanorama: 0,
    hasAudio: 0,
  },
  {
    id: 'zhifangdi',
    name: '职方第',
    summary: '现场景点分布牌2号点位，岭南传统宅第，详细历史资料待景区审核。',
    category: '宅第建筑',
    coverImage: '/images/jinlou-02.jpg',
    hasPanorama: 0,
    hasAudio: 0,
  },
  {
    id: 'duizhao',
    name: '对朝',
    summary: '现场景点分布牌3号点位，名称与位置已确认，详细介绍待景区审核。',
    category: '建筑构件',
    coverImage: '/images/jinlou-02.jpg',
    hasPanorama: 0,
    hasAudio: 0,
  },
  {
    id: 'jinlou',
    name: '金楼（赋鹤楼）',
    summary: '碧江金楼核心建筑，景点介绍与开放信息待景区审核。',
    category: '古建景点',
    coverImage: '/images/jinlou-01.jpg',
    hasPanorama: 1,
    hasAudio: 0,
  },
  { id: 'shouqingwu', name: '守清屋', summary: '现场景点分布牌5号点位，详细历史资料待景区审核。', category: '传统民居', coverImage: '/images/jinlou-02.jpg', hasPanorama: 0, hasAudio: 0 },
  { id: 'boshao-clinic', name: '伯韶医馆', summary: '现场景点分布牌6号点位，展陈内容与人物资料待景区审核。', category: '历史展陈', coverImage: '/images/jinlou-03.jpg', hasPanorama: 0, hasAudio: 0 },
  { id: 'nilou', name: '泥楼', summary: '现场景点分布牌7号点位，建筑材料与营造介绍待景区审核。', category: '传统民居', coverImage: '/images/jinlou-02.jpg', hasPanorama: 0, hasAudio: 0 },
  { id: 'wokear-residence', name: '镬耳民居', summary: '现场景点分布牌8号点位，建筑形制介绍待景区审核。', category: '传统民居', coverImage: '/images/jinlou-02.jpg', hasPanorama: 0, hasAudio: 0 },
  { id: 'wokear-house', name: '镬耳大屋', summary: '现场景点分布牌9号点位，建筑形制介绍待景区审核。', category: '传统民居', coverImage: '/images/jinlou-02.jpg', hasPanorama: 0, hasAudio: 0 },
  { id: 'yiyu-school', name: '亦渔遗塾', summary: '现场景点分布牌10号点位，家塾历史与展陈内容待景区审核。', category: '教育建筑', coverImage: '/images/jinlou-03.jpg', hasPanorama: 0, hasAudio: 0 },
  { id: 'components-exhibit', name: '民居构件展示', summary: '现场景点分布牌11号点位，构件名称与说明待景区审核。', category: '专题展陈', coverImage: '/images/jinlou-01.jpg', hasPanorama: 0, hasAudio: 0 },
  { id: 'twenty-four-odes', name: '二十四咏', summary: '现场景点分布牌12号点位，作品内容与背景资料待景区审核。', category: '文化景观', coverImage: '/images/jinlou-01.jpg', hasPanorama: 0, hasAudio: 0 },
  { id: 'baoyue-pavilion', name: '抱月亭', summary: '现场景点分布牌13号点位，园林景观介绍待景区审核。', category: '亭台景观', coverImage: '/images/jinlou-03.jpg', hasPanorama: 0, hasAudio: 0 },
  { id: 'diequ-pavilion', name: '叠趣亭', summary: '现场景点分布牌14号点位，园林景观介绍待景区审核。', category: '亭台景观', coverImage: '/images/jinlou-03.jpg', hasPanorama: 0, hasAudio: 0 },
  {
    id: 'garden',
    name: '后花园',
    summary: '现场景点分布牌15号点位，园林与水院开放范围待现场确认。',
    category: '园林景观',
    coverImage: '/images/jinlou-03.jpg',
    hasPanorama: 1,
    hasAudio: 0,
  },
];

for (const content of reviewedSpotContent) {
  const spot = seedSpots.find((item) => item.id === content.id);
  Object.assign(spot, content);
}

const seedPanoramas = [
  {
    id: 'jinlou-main-hall',
    spotId: 'jinlou',
    name: '金楼内景',
    summary: '用于验证全景列表与场景切换流程，真实全景素材待采集。',
    previewImage: '/images/jinlou-01.jpg',
    status: 'pending',
  },
  {
    id: 'garden-courtyard',
    spotId: 'garden',
    name: '庭院园林',
    summary: '预留庭院全景与热点讲解位置，拍摄点位待现场确认。',
    previewImage: '/images/jinlou-03.jpg',
    status: 'pending',
  },
];

const seedHotspots = [
  {
    id: 'woodcarving-intro',
    panoramaId: 'jinlou-main-hall',
    type: 'info',
    title: '木雕工艺介绍',
    content: '热点位置和讲解内容为开发示意，待景区审核与现场标定。',
    targetPanoramaId: null,
    positionX: 35,
    positionY: 42,
  },
  {
    id: 'to-garden',
    panoramaId: 'jinlou-main-hall',
    type: 'scene',
    title: '前往庭院园林',
    content: '切换至另一个预设场景。',
    targetPanoramaId: 'garden-courtyard',
    positionX: 72,
    positionY: 55,
  },
  {
    id: 'garden-intro',
    panoramaId: 'garden-courtyard',
    type: 'info',
    title: '庭院景观介绍',
    content: '真实景观名称、位置和讲解内容待现场采集后确认。',
    targetPanoramaId: null,
    positionX: 48,
    positionY: 38,
  },
  {
    id: 'to-jinlou',
    panoramaId: 'garden-courtyard',
    type: 'scene',
    title: '返回金楼内景',
    content: '切换至另一个预设场景。',
    targetPanoramaId: 'jinlou-main-hall',
    positionX: 20,
    positionY: 58,
  },
];

const seedRecommendations = [
  ['food-1', 'food', '顺德特色美食', '餐饮参考', '碧江金楼周边', '营业时间请以到店信息为准', '/images/arc/arc-colonnade.jpg', '可留意双皮奶、鱼皮等顺德特色风味。', '', '', '双皮奶与鱼皮', 10, 'reviewed', '比赛展示资料 · 非商户广告'],
  ['hotel-1', 'hotel', '拾光美宿酒店（北滘碧江店）', '住宿参考', '距碧江金楼步行约700米', '房态与价格请以住宿平台实时信息为准', '/images/arc/arc-garden-moon.jpg', '用户提供的住宿平台截图显示该店位于景点附近。', '', '', '附近住宿', 20, 'reviewed', '用户提供截图 · 2026-10-27'],
  ['transport-1', 'transport', '交通方案待接入', '交通', '路线待接入', '班次信息待接入', '/images/jinlou-03.jpg', '', '', '', '', 30, 'pending-review', '景区接口 · 占位数据'],
  ['attraction-1', 'attraction', '清晖园', '岭南园林', '佛山市顺德区大良街道清晖路23号', '开放安排请以景区当日公告为准', '/images/arc/arc-gable.jpg', '可作为碧江金楼行程后的顺德古建延伸参观。', '', '', '周边景点', 40, 'reviewed', '比赛展示资料 · 出发前核实'],
];

const seedRoutes = [
  {
    id: 'visitor-classic',
    name: '经典参观参考线',
    theme: '参考公开游客实走记录，顺序待景区确认',
    duration: '参考游记约1—1.5小时，待实测',
    audience: '首次到访游客',
    stops: ['职方第', '金楼', '泥楼', '后花园', '亦渔遗塾'],
  },
  {
    id: 'architecture-focus',
    name: '古建重点线',
    theme: '集中查看祠堂、宅第、金楼与传统民居',
    duration: '用时待现场实走确认',
    audience: '文化与摄影爱好者',
    stops: ['南山祠', '职方第', '对朝', '金楼', '伯韶医馆', '泥楼', '镬耳民居', '镬耳大屋', '亦渔遗塾', '民居构件展示'],
  },
  {
    id: 'garden-slow',
    name: '园林慢游线',
    theme: '从核心建筑走向荷池、亭台与后花园',
    duration: '用时待现场实走确认',
    audience: '亲子与轻松游览游客',
    stops: ['金楼', '后花园', '抱月亭', '二十四咏', '叠趣亭'],
  },
];

const seedSitePoints = [
  [1, '南山祠', 84, 74],
  [2, '职方第', 75, 84],
  [3, '对朝', 61, 78],
  [4, '金楼', 41, 70],
  [5, '守清屋', 62, 61],
  [6, '伯韶医馆', 51, 61],
  [7, '泥楼', 41, 59],
  [8, '镬耳民居', 72, 54],
  [9, '镬耳大屋', 41, 48],
  [10, '亦渔遗塾', 69, 14],
  [11, '民居构件展示', 51, 19],
  [12, '二十四咏', 42, 15],
  [13, '抱月亭', 42, 27],
  [14, '叠趣亭', 17, 71],
  [15, '后花园', 26, 43],
];

const sitePointSpotIds = [
  'nanshan-hall', 'zhifangdi', 'duizhao', 'jinlou', 'shouqingwu',
  'boshao-clinic', 'nilou', 'wokear-residence', 'wokear-house', 'yiyu-school',
  'components-exhibit', 'twenty-four-odes', 'baoyue-pavilion', 'diequ-pavilion', 'garden',
];

const routePointPositions = Object.fromEntries(seedSitePoints.map(([, name, x, y]) => [name, [x, y]]));

const seedNarrations = [
  ['jinlou-zh', 'jinlou', 'zh-CN', '普通话', '欢迎了解金楼。当前讲解文字为开发示例，具体历史与工艺内容待景区审核。', ''],
  ['jinlou-yue', 'jinlou', 'yue', '粤语', '欢迎了解金楼。呢段系开发阶段示例，正式粤语讲解内容有待景区审核。', ''],
  ['jinlou-en', 'jinlou', 'en', 'English', 'Welcome to the Golden Pavilion. This is placeholder narration pending official review.', ''],
  ['zhifangdi-zh', 'zhifangdi', 'zh-CN', '普通话', '这里是职方第。建筑沿革与空间介绍待景区审核后补充。', ''],
  ['zhifangdi-yue', 'zhifangdi', 'yue', '粤语', '呢度系职方第。建筑历史同空间介绍有待景区审核。', ''],
  ['zhifangdi-en', 'zhifangdi', 'en', 'English', 'This is Zhifangdi. Its verified history and spatial description will be added later.', ''],
];

for (const narration of reviewedNarrations) {
  const existingIndex = seedNarrations.findIndex((item) => item[1] === narration.spotId && item[2] === narration.languageCode);
  const row = [narration.id, narration.spotId, narration.languageCode, narration.languageLabel, narration.transcript, narration.audioUrl, 'pending', narration.audioType];
  if (existingIndex >= 0) seedNarrations[existingIndex] = row;
  else seedNarrations.push(row);
}

const seedCraftGuides = [
  {
    id: 'jinlou-woodcarving',
    spotId: 'jinlou',
    title: '木雕工艺图解',
    summary: '通过分步图解认识构件、雕刻与饰金层次；当前内容为教学演示，待景区专家审核。',
    image: '/images/jinlou-01.jpg',
    steps: [
      ['观察构件', '从梁架、门窗等位置辨认木雕构件；具体点位待现场标定。'],
      ['理解雕刻层次', '用浅浮雕、深浮雕等概念辅助观察，正式术语与实例待专家确认。'],
      ['查看饰金效果', '留意金色装饰与木质底色的层次关系；材料和工序待资料审核。'],
    ],
  },
];

export function createDatabase(filename = ':memory:') {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`
    CREATE TABLE IF NOT EXISTS spots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      summary TEXT NOT NULL,
      category TEXT NOT NULL,
      cover_image TEXT NOT NULL,
      has_panorama INTEGER NOT NULL DEFAULT 0,
      has_audio INTEGER NOT NULL DEFAULT 0
    ) STRICT;
    CREATE TABLE IF NOT EXISTS panoramas (
      id TEXT PRIMARY KEY,
      spot_id TEXT NOT NULL,
      name TEXT NOT NULL,
      summary TEXT NOT NULL,
      preview_image TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (spot_id) REFERENCES spots(id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS panorama_hotspots (
      id TEXT PRIMARY KEY,
      panorama_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('info', 'scene')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      target_panorama_id TEXT,
      position_x INTEGER NOT NULL,
      position_y INTEGER NOT NULL,
      FOREIGN KEY (panorama_id) REFERENCES panoramas(id),
      FOREIGN KEY (target_panorama_id) REFERENCES panoramas(id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS service_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      ticket_url TEXT NOT NULL DEFAULT '',
      ticket_app_id TEXT NOT NULL DEFAULT '',
      ticket_path TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL,
      opening_hours TEXT NOT NULL,
      phone TEXT NOT NULL,
      transport TEXT NOT NULL,
      latitude REAL,
      longitude REAL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS recommendations (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL CHECK (category IN ('food', 'hotel', 'transport', 'attraction')),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      address TEXT NOT NULL,
      availability TEXT NOT NULL,
      image TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending-review',
      sort_order INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      link_url TEXT NOT NULL DEFAULT '',
      product_name TEXT NOT NULL DEFAULT '',
      latitude REAL,
      longitude REAL,
      source_note TEXT NOT NULL DEFAULT ''
    ) STRICT;
    CREATE TABLE IF NOT EXISTS tour_routes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      theme TEXT NOT NULL,
      duration TEXT NOT NULL,
      audience TEXT NOT NULL,
      stops_json TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS tour_route_points (
      route_id TEXT NOT NULL,
      stop_order INTEGER NOT NULL,
      name TEXT NOT NULL,
      position_x INTEGER NOT NULL,
      position_y INTEGER NOT NULL,
      PRIMARY KEY (route_id, stop_order),
      FOREIGN KEY (route_id) REFERENCES tour_routes(id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS site_points (
      number INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      position_x INTEGER NOT NULL,
      position_y INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS narrations (
      id TEXT PRIMARY KEY,
      spot_id TEXT NOT NULL,
      language_code TEXT NOT NULL,
      language_label TEXT NOT NULL,
      transcript TEXT NOT NULL,
      audio_url TEXT NOT NULL DEFAULT '',
      review_status TEXT NOT NULL DEFAULT 'draft',
      audio_type TEXT NOT NULL DEFAULT 'none',
      UNIQUE (spot_id, language_code),
      FOREIGN KEY (spot_id) REFERENCES spots(id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS craft_guides (
      id TEXT PRIMARY KEY,
      spot_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      image TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      model_url TEXT NOT NULL DEFAULT '',
      UNIQUE (spot_id),
      FOREIGN KEY (spot_id) REFERENCES spots(id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS assistant_faqs (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      keywords_json TEXT NOT NULL,
      answer TEXT NOT NULL,
      sources_json TEXT NOT NULL,
      review_status TEXT NOT NULL DEFAULT 'pending-scenic-review',
      public_status TEXT NOT NULL DEFAULT 'review-draft'
    ) STRICT;
  `);

  // 教学版已按产品边界移除点赞评论互动；启动时清理旧库遗留的空表，使老数据库自动迁移。
  db.exec('DROP TABLE IF EXISTS comment_reports');
  db.exec('DROP TABLE IF EXISTS spot_comments');
  db.exec('DROP TABLE IF EXISTS spot_likes');

  const serviceColumns = new Set(db.prepare('PRAGMA table_info(service_config)').all().map((column) => column.name));
  if (!serviceColumns.has('latitude')) db.exec('ALTER TABLE service_config ADD COLUMN latitude REAL');
  if (!serviceColumns.has('longitude')) db.exec('ALTER TABLE service_config ADD COLUMN longitude REAL');
  if (!serviceColumns.has('ticket_app_id')) db.exec("ALTER TABLE service_config ADD COLUMN ticket_app_id TEXT NOT NULL DEFAULT ''");
  if (!serviceColumns.has('ticket_path')) db.exec("ALTER TABLE service_config ADD COLUMN ticket_path TEXT NOT NULL DEFAULT ''");
  const recommendationColumns = new Set(db.prepare('PRAGMA table_info(recommendations)').all().map((column) => column.name));
  if (!recommendationColumns.has('status')) db.exec("ALTER TABLE recommendations ADD COLUMN status TEXT NOT NULL DEFAULT 'pending-review'");
  if (!recommendationColumns.has('sort_order')) db.exec('ALTER TABLE recommendations ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
  if (!recommendationColumns.has('description')) db.exec("ALTER TABLE recommendations ADD COLUMN description TEXT NOT NULL DEFAULT ''");
  if (!recommendationColumns.has('phone')) db.exec("ALTER TABLE recommendations ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
  if (!recommendationColumns.has('link_url')) db.exec("ALTER TABLE recommendations ADD COLUMN link_url TEXT NOT NULL DEFAULT ''");
  if (!recommendationColumns.has('product_name')) db.exec("ALTER TABLE recommendations ADD COLUMN product_name TEXT NOT NULL DEFAULT ''");
  if (!recommendationColumns.has('latitude')) db.exec('ALTER TABLE recommendations ADD COLUMN latitude REAL');
  if (!recommendationColumns.has('longitude')) db.exec('ALTER TABLE recommendations ADD COLUMN longitude REAL');
  if (!recommendationColumns.has('source_note')) db.exec("ALTER TABLE recommendations ADD COLUMN source_note TEXT NOT NULL DEFAULT ''");
  const narrationColumns = new Set(db.prepare('PRAGMA table_info(narrations)').all().map((column) => column.name));
  if (!narrationColumns.has('review_status')) db.exec("ALTER TABLE narrations ADD COLUMN review_status TEXT NOT NULL DEFAULT 'draft'");
  if (!narrationColumns.has('audio_type')) db.exec("ALTER TABLE narrations ADD COLUMN audio_type TEXT NOT NULL DEFAULT 'none'");

  const spotCount = db.prepare('SELECT COUNT(*) AS total FROM spots').get().total;
  if (spotCount === 0) {
    const insertSpot = db.prepare(`
    INSERT INTO spots (id, name, summary, category, cover_image, has_panorama, has_audio)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
    for (const spot of seedSpots) {
      insertSpot.run(spot.id, spot.name, spot.summary, spot.category, spot.coverImage, spot.hasPanorama, spot.hasAudio);
    }
  }

  const panoramaCount = db.prepare('SELECT COUNT(*) AS total FROM panoramas').get().total;
  if (panoramaCount === 0) {
    const insertPanorama = db.prepare(`
      INSERT INTO panoramas (id, spot_id, name, summary, preview_image, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const panorama of seedPanoramas) {
      insertPanorama.run(
        panorama.id,
        panorama.spotId,
        panorama.name,
        panorama.summary,
        panorama.previewImage,
        panorama.status,
      );
    }
  }

  const hotspotCount = db.prepare('SELECT COUNT(*) AS total FROM panorama_hotspots').get().total;
  if (hotspotCount === 0) {
    const insertHotspot = db.prepare(`
      INSERT INTO panorama_hotspots
        (id, panorama_id, type, title, content, target_panorama_id, position_x, position_y)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const hotspot of seedHotspots) {
      insertHotspot.run(
        hotspot.id,
        hotspot.panoramaId,
        hotspot.type,
        hotspot.title,
        hotspot.content,
        hotspot.targetPanoramaId,
        hotspot.positionX,
        hotspot.positionY,
      );
    }
  }

  db.prepare(`
    INSERT OR IGNORE INTO service_config (id, ticket_url, address, opening_hours, phone, transport, latitude, longitude)
    VALUES (1, '', '广东省佛山市顺德区北滘镇碧江社区泰宁西路6号', '每日08:30—17:00；停止入园时间及临时闭园安排请以景区当日公告为准', '0757-26632123', '公交可在德云市场站下车后步行前往；具体线路、停车位置及实时路况请以地图导航和景区公告为准。', 22.942558, 113.262272)
  `).run();

  db.prepare(`
    UPDATE service_config
    SET address = ?, opening_hours = ?, phone = ?, transport = ?, latitude = ?, longitude = ?
    WHERE id = 1 AND address = '地址待景区确认' AND phone = '联系电话待景区确认'
  `).run(
    '广东省佛山市顺德区北滘镇碧江社区泰宁西路6号',
    '每日08:30—17:00；停止入园时间及临时闭园安排请以景区当日公告为准',
    '0757-26632123',
    '公交可在德云市场站下车后步行前往；具体线路、停车位置及实时路况请以地图导航和景区公告为准。',
    22.942558,
    113.262272,
  );

  const recommendationCount = db.prepare('SELECT COUNT(*) AS total FROM recommendations').get().total;
  if (recommendationCount === 0) {
    const insertRecommendation = db.prepare(`
      INSERT INTO recommendations
        (id, category, name, type, address, availability, image, description, phone, link_url, product_name, sort_order, status, source_note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const recommendation of seedRecommendations) insertRecommendation.run(...recommendation);
  }
  const refreshRecommendation = db.prepare(`
    UPDATE recommendations
    SET category = ?, name = ?, type = ?, address = ?, availability = ?, image = ?, description = ?, phone = ?, link_url = ?, product_name = ?, sort_order = ?, status = ?, source_note = ?
    WHERE id = ? AND status = 'pending-review' AND name LIKE '%待接入%'
  `);
  for (const item of seedRecommendations.filter(([, category]) => category !== 'transport')) {
    const [id, ...values] = item;
    refreshRecommendation.run(...values, id);
  }

  const routeCount = db.prepare('SELECT COUNT(*) AS total FROM tour_routes').get().total;
  if (routeCount === 0) {
    const insertRoute = db.prepare(`
      INSERT INTO tour_routes (id, name, theme, duration, audience, stops_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertRoutePoint = db.prepare(`
      INSERT INTO tour_route_points (route_id, stop_order, name, position_x, position_y)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const route of seedRoutes) {
      insertRoute.run(route.id, route.name, route.theme, route.duration, route.audience, JSON.stringify(route.stops));
      route.stops.forEach((stop, index) => {
        const [positionX, positionY] = routePointPositions[stop];
        insertRoutePoint.run(route.id, index + 1, stop, positionX, positionY);
      });
    }
  }

  const sitePointCount = db.prepare('SELECT COUNT(*) AS total FROM site_points').get().total;
  if (sitePointCount === 0) {
    const insertSitePoint = db.prepare('INSERT INTO site_points (number, name, position_x, position_y) VALUES (?, ?, ?, ?)');
    for (const point of seedSitePoints) insertSitePoint.run(...point);
  }

  const narrationCount = db.prepare('SELECT COUNT(*) AS total FROM narrations').get().total;
  if (narrationCount === 0) {
    const insertNarration = db.prepare(`
      INSERT INTO narrations (id, spot_id, language_code, language_label, transcript, audio_url, review_status, audio_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const narration of seedNarrations) insertNarration.run(...narration.slice(0, 6), narration[6] || 'draft', narration[7] || 'none');
  }
  runDatabaseMigrations(db);

  const craftGuideCount = db.prepare('SELECT COUNT(*) AS total FROM craft_guides').get().total;
  if (craftGuideCount === 0) {
    const insertCraftGuide = db.prepare(`
      INSERT INTO craft_guides (id, spot_id, title, summary, image, steps_json, model_url)
      VALUES (?, ?, ?, ?, ?, ?, '')
    `);
    for (const guide of seedCraftGuides) {
      insertCraftGuide.run(guide.id, guide.spotId, guide.title, guide.summary, guide.image, JSON.stringify(guide.steps));
    }
  }
  const faqCount = db.prepare('SELECT COUNT(*) AS total FROM assistant_faqs').get().total;
  if (faqCount === 0) {
    const insertFaq = db.prepare(`INSERT INTO assistant_faqs
      (id, question, keywords_json, answer, sources_json) VALUES (?, ?, ?, ?, ?)`);
    for (const faq of reviewedFaqs) insertFaq.run(faq.id, faq.question, JSON.stringify(faq.keywords), faq.answer, JSON.stringify(faq.sources));
  }
  return db;
}

function serializeSpot(row) {
  return {
    id: row.id,
    name: row.name,
    summary: row.summary,
    category: row.category,
    coverImage: row.cover_image,
    hasPanorama: Boolean(row.has_panorama),
    hasAudio: Boolean(row.has_audio),
  };
}

export function listSpots(db) {
  const order = new Map(seedSpots.map((spot, index) => [spot.id, index]));
  return db.prepare('SELECT * FROM spots').all()
    .sort((left, right) => order.get(left.id) - order.get(right.id))
    .map(serializeSpot);
}

export function getSpot(db, id) {
  const row = db.prepare('SELECT * FROM spots WHERE id = ?').get(id);
  return row ? serializeSpot(row) : null;
}

function serializePanorama(row) {
  return {
    id: row.id,
    spotId: row.spot_id,
    name: row.name,
    summary: row.summary,
    previewImage: row.preview_image,
    status: row.status,
  };
}

export function listPanoramas(db) {
  return db.prepare('SELECT * FROM panoramas ORDER BY rowid').all().map(serializePanorama);
}

export function getPanorama(db, id) {
  const row = db.prepare('SELECT * FROM panoramas WHERE id = ?').get(id);
  if (!row) return null;
  const hotspots = db.prepare('SELECT * FROM panorama_hotspots WHERE panorama_id = ? ORDER BY rowid').all(id);
  return {
    ...serializePanorama(row),
    hotspots: hotspots.map((hotspot) => ({
      id: hotspot.id,
      type: hotspot.type,
      title: hotspot.title,
      content: hotspot.content,
      targetPanoramaId: hotspot.target_panorama_id,
      positionX: hotspot.position_x,
      positionY: hotspot.position_y,
    })),
  };
}

export function getServiceConfig(db) {
  const row = db.prepare('SELECT * FROM service_config WHERE id = 1').get();
  const addressReady = Boolean(row.address && !/待|确认/.test(row.address));
  const phoneReady = Boolean(row.phone && !/待|确认/.test(row.phone));
  const mapReady = Number.isFinite(row.latitude) && Number.isFinite(row.longitude);
  const miniProgramTicketReady = Boolean(row.ticket_app_id && row.ticket_path);
  const ticketReady = Boolean(row.ticket_url) || miniProgramTicketReady;
  return {
    ticket: {
      enabled: ticketReady,
      url: row.ticket_url,
      label: ticketReady ? '前往订票' : '订票入口准备中',
      appId: row.ticket_app_id,
      path: row.ticket_path,
    },
    address: row.address,
    openingHours: row.opening_hours,
    phone: row.phone,
    transport: row.transport,
    latitude: row.latitude,
    longitude: row.longitude,
    actions: {
      copyAddress: addressReady,
      callPhone: phoneReady,
      openMap: mapReady,
    },
  };
}

export function listRecommendations(db, category) {
  const rows = category
    ? db.prepare('SELECT * FROM recommendations WHERE category = ? ORDER BY sort_order, rowid').all(category)
    : db.prepare('SELECT * FROM recommendations ORDER BY sort_order, rowid').all();
  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    name: row.name,
    type: row.type,
    address: row.address,
    availability: row.availability,
    image: row.image,
    sortOrder: row.sort_order,
    description: row.description,
    phone: row.phone,
    linkUrl: row.link_url,
    productName: row.product_name,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
    sourceNote: row.source_note,
  }));
}

export function listTourRoutes(db) {
  return db.prepare('SELECT * FROM tour_routes ORDER BY rowid').all().map((row) => ({
    id: row.id,
    name: row.name,
    theme: row.theme,
    duration: row.duration,
    audience: row.audience,
    stops: JSON.parse(row.stops_json),
    points: db.prepare(`
      SELECT route_point.name, route_point.position_x, route_point.position_y, site_point.number AS site_number
      FROM tour_route_points AS route_point
      JOIN site_points AS site_point ON site_point.name = route_point.name
      WHERE route_point.route_id = ? ORDER BY route_point.stop_order
    `).all(row.id).map((point, index) => ({
      number: index + 1,
      siteNumber: point.site_number,
      name: point.name,
      positionX: point.position_x,
      positionY: point.position_y,
    })),
  }));
}

export function listSitePoints(db) {
  return db.prepare('SELECT * FROM site_points ORDER BY number').all().map((row) => ({
    number: row.number,
    spotId: sitePointSpotIds[row.number - 1],
    name: row.name,
    positionX: row.position_x,
    positionY: row.position_y,
  }));
}

export function listNarrations(db, spotId) {
  return db.prepare('SELECT * FROM narrations WHERE spot_id = ? ORDER BY rowid').all(spotId).map((row) => ({
    id: row.id,
    spotId: row.spot_id,
    languageCode: row.language_code,
    languageLabel: row.language_label,
    transcript: row.transcript,
    audioUrl: row.audio_url,
    audioReady: Boolean(row.audio_url),
    reviewStatus: row.review_status,
    audioType: row.audio_type,
    notice: row.audio_type === 'system-tts-preview'
      ? `${row.language_label}试听由系统语音合成，内容与发音待景区审核；播放失败时可直接阅读文字稿`
      : (row.audio_url ? '讲解内容与发音待景区审核' : '讲解文字已整理，正式音频待录制'),
  }));
}

export function listAllNarrations(db) {
  return db.prepare(`SELECT narration.*, spot.name AS spot_name FROM narrations AS narration
    JOIN spots AS spot ON spot.id = narration.spot_id ORDER BY spot.rowid, narration.rowid`).all().map((row) => ({
    id: row.id, spotId: row.spot_id, spotName: row.spot_name, languageLabel: row.language_label,
    transcript: row.transcript, audioUrl: row.audio_url, reviewStatus: row.review_status, audioType: row.audio_type,
  }));
}

export function updateNarrationReview(db, id, reviewStatus) {
  if (!['draft', 'pending', 'approved', 'rejected'].includes(reviewStatus)) throw new Error('讲解审核状态不正确');
  return db.prepare('UPDATE narrations SET review_status = ? WHERE id = ?').run(reviewStatus, id).changes > 0;
}

export function listAssistantFaqs(db) {
  return db.prepare('SELECT * FROM assistant_faqs ORDER BY rowid').all().map((row) => ({
    id: row.id, question: row.question, keywords: JSON.parse(row.keywords_json), answer: row.answer,
    sources: JSON.parse(row.sources_json), reviewStatus: row.review_status, publicStatus: row.public_status,
  }));
}

export function updateAssistantFaq(db, id, changes) {
  const current = db.prepare('SELECT * FROM assistant_faqs WHERE id = ?').get(id);
  if (!current) return null;
  const answer = String(changes.answer ?? current.answer).trim();
  const reviewStatus = String(changes.reviewStatus ?? current.review_status).trim();
  const publicStatus = String(changes.publicStatus ?? current.public_status).trim();
  if (!answer || answer.length > 1000) throw new Error('答案须为1—1000个字符');
  if (!['pending-scenic-review', 'approved', 'rejected'].includes(reviewStatus)) throw new Error('问答审核状态不正确');
  if (!['review-draft', 'public', 'not-ready'].includes(publicStatus)) throw new Error('问答公开状态不正确');
  db.prepare('UPDATE assistant_faqs SET answer = ?, review_status = ?, public_status = ? WHERE id = ?')
    .run(answer, reviewStatus, publicStatus, id);
  return listAssistantFaqs(db).find((faq) => faq.id === id);
}

export function updateTourRoute(db, id, changes) {
  const current = db.prepare('SELECT * FROM tour_routes WHERE id = ?').get(id);
  if (!current) return null;
  const route = {
    name: String(changes.name ?? current.name).trim(), theme: String(changes.theme ?? current.theme).trim(),
    duration: String(changes.duration ?? current.duration).trim(), audience: String(changes.audience ?? current.audience).trim(),
    stops: changes.stops ?? JSON.parse(current.stops_json),
  };
  if (!route.name || !route.theme || !route.duration || !route.audience) throw new Error('路线文字不能为空');
  if (!Array.isArray(route.stops) || !route.stops.length) throw new Error('路线至少需要一个站点');
  const findPoint = db.prepare('SELECT name, position_x, position_y FROM site_points WHERE name = ?');
  const points = route.stops.map((name) => findPoint.get(String(name).trim()));
  if (points.some((point) => !point)) throw new Error('路线包含不存在的景点名称');
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE tour_routes SET name = ?, theme = ?, duration = ?, audience = ?, stops_json = ? WHERE id = ?')
      .run(route.name, route.theme, route.duration, route.audience, JSON.stringify(route.stops), id);
    db.prepare('DELETE FROM tour_route_points WHERE route_id = ?').run(id);
    const insert = db.prepare('INSERT INTO tour_route_points (route_id, stop_order, name, position_x, position_y) VALUES (?, ?, ?, ?, ?)');
    points.forEach((point, index) => insert.run(id, index + 1, point.name, point.position_x, point.position_y));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return listTourRoutes(db).find((item) => item.id === id);
}

export function getCraftGuide(db, spotId) {
  const row = db.prepare('SELECT * FROM craft_guides WHERE spot_id = ?').get(spotId);
  if (!row) return null;
  return {
    id: row.id,
    spotId: row.spot_id,
    title: row.title,
    summary: row.summary,
    image: row.image,
    steps: JSON.parse(row.steps_json).map(([title, description], index) => ({
      number: index + 1,
      title,
      description,
    })),
    modelUrl: row.model_url,
    modelReady: Boolean(row.model_url),
    notice: '工艺名称、点位与制作流程待景区专家审核',
  };
}
