// 碧江金楼游客端读取与管理端内容维护接口（事件型云函数）
// 数据来源优先顺序：云数据库集合 bijiang_content → 随函数打包的 data.json 快照。
// 这样即使云数据库、SDK 或依赖安装出问题，小程序仍能正常读取原有资料。
const bundledSnapshot = require('./data.json');
const { SOURCE_IDS, assistantSuggestions, resolveKnowledgeSources } = require('./knowledge-sources');
const assistant = require('./assistant');

const assistantProvider = assistant.selectProvider(process.env);

const COLLECTION = 'bijiang_content';
const ADMIN_LOG_COLLECTION = 'bijiang_admin_logs';
const RECOMMENDATION_METRICS_COLLECTION = 'bijiang_recommendation_metrics';
const CACHE_TTL_MS = 60 * 1000;
const ADMIN_TOKEN_ENV = 'BIJIANG_ADMIN_TOKEN';
const RECOMMENDATION_CATEGORIES = ['food', 'hotel', 'transport', 'attraction'];
const IMAGE_UPLOAD_GROUPS = ['home', 'spots', 'recommendations'];
const IMAGE_MIME_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_ADMIN_IMAGE_BYTES = 2 * 1024 * 1024;
const DEFAULT_HOME = {
  heroImage: '/images/jinlou-home-hero-v2.jpg',
  title: '一卷书香 · 一院金光',
  subtitle: '碧江金楼智慧导览',
};
const RECOMMENDATION_ACTIONS = ['detail', 'phone', 'link'];

const error = (code, message) => ({ ok: false, error: { code, message } });
const success = (response) => ({ ok: true, response });
const isMissingCollectionError = (value) => /collection not exists|Db or Table not exist|DATABASE_COLLECTION_NOT_EXIST|-502005/i.test(String(value?.message || value || ''));

// 懒加载并容错：依赖缺失时不让函数整体崩溃。
let cloudSdk = null;
let database = null;
try {
  cloudSdk = require('wx-server-sdk');
  cloudSdk.init({ env: cloudSdk.DYNAMIC_CURRENT_ENV });
  database = cloudSdk.database();
} catch (loadError) {
  console.warn('wx-server-sdk 不可用，将使用随函数打包的快照：', loadError.message);
}

async function uploadAdminImage(body) {
  if (!cloudSdk) throw new Error('云存储组件不可用');
  const group = text(body?.group, 30);
  const targetId = text(body?.targetId, 80).replace(/[^a-zA-Z0-9_-]/g, '') || 'general';
  const mimeType = text(body?.mimeType, 40).toLowerCase();
  const base64 = typeof body?.base64 === 'string' ? body.base64.replace(/^data:[^;]+;base64,/, '') : '';
  if (!IMAGE_UPLOAD_GROUPS.includes(group)) return { validationError: '图片上传目录不正确' };
  if (!IMAGE_MIME_TYPES[mimeType]) return { validationError: '只支持 JPG、PNG 或 WebP 图片' };
  if (!base64 || !/^[a-zA-Z0-9+/=]+$/.test(base64)) return { validationError: '图片内容为空或格式不正确' };
  const fileContent = Buffer.from(base64, 'base64');
  if (!fileContent.length) return { validationError: '图片内容为空' };
  if (fileContent.length > MAX_ADMIN_IMAGE_BYTES) return { validationError: '处理后的图片不能超过2MB，请选择更小的照片' };
  const random = require('node:crypto').randomBytes(5).toString('hex');
  const cloudPath = `bijiang-heritage/admin-uploads/${group}/${targetId}/${Date.now()}-${random}.${IMAGE_MIME_TYPES[mimeType]}`;
  const uploaded = await cloudSdk.uploadFile({ cloudPath, fileContent });
  if (!uploaded?.fileID) throw new Error('云存储未返回文件ID');
  if (database) {
    await database.collection(ADMIN_LOG_COLLECTION).add({
      data: { action: 'upload-admin-image', targetId: `${group}:${targetId}`, fields: [cloudPath], createdAt: new Date() },
    });
  }
  return { fileID: uploaded.fileID, cloudPath, size: fileContent.length };
}

let cache = { snapshot: null, loadedAt: 0, source: 'bundled-snapshot' };

function normalizeCloudAudio(snapshot) {
  const narrations = Object.fromEntries(Object.entries(snapshot.narrations || {}).map(([spotId, resource]) => [spotId, {
    ...resource,
    data: (resource.data || []).map((item) => {
      const remotelyPlayable = typeof item.audioUrl === 'string' && (item.audioUrl.startsWith('cloud://') || /^https:\/\//i.test(item.audioUrl));
      if (item.audioType !== 'system-tts-preview' || remotelyPlayable) return item;
      return {
        ...item,
        audioUrl: '',
        audioReady: false,
        notice: '普通话试听尚未完成云端发布校验，请先阅读文字稿',
      };
    }),
  }]));
  return { ...snapshot, narrations };
}

function rebuildSnapshot(documents) {
  const snapshot = { faqs: [] };
  for (const document of documents) {
    const id = String(document._id);
    const separator = id.indexOf(':');
    if (separator === -1) {
      if (id === 'snapshot-meta') snapshot.meta = document.value;
      else snapshot[id] = document.value;
      continue;
    }
    const group = id.slice(0, separator);
    const key = id.slice(separator + 1);
    if (!snapshot[group] || typeof snapshot[group] !== 'object') snapshot[group] = {};
    snapshot[group][key] = document.value;
  }
  return snapshot;
}

async function getSnapshot() {
  if (cache.snapshot && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;
  try {
    if (!database) throw new Error('云数据库不可用');
    const result = await database.collection(COLLECTION).limit(100).get();
    const documents = result.data || [];
    if (!documents.length) throw new Error('云数据库集合为空');
    cache = { snapshot: normalizeCloudAudio(rebuildSnapshot(documents)), loadedAt: Date.now(), source: 'cloud-database' };
  } catch (readError) {
    console.warn('读取云数据库失败，回退到打包快照：', readError.message);
    cache = { snapshot: normalizeCloudAudio(bundledSnapshot), loadedAt: Date.now(), source: 'bundled-snapshot' };
  }
  return cache;
}

function safeEqual(expected, provided) {
  if (!expected || !provided) return false;
  const left = Buffer.from(String(expected));
  const right = Buffer.from(String(provided));
  if (left.length !== right.length) return false;
  return require('node:crypto').timingSafeEqual(left, right);
}

function isAdmin(event) {
  return safeEqual(process.env[ADMIN_TOKEN_ENV], event.adminToken);
}

function validateSpotContent(body) {
  const spot = {
    name: typeof body?.name === 'string' ? body.name.trim() : '',
    category: typeof body?.category === 'string' ? body.category.trim() : '',
    summary: typeof body?.summary === 'string' ? body.summary.trim() : '',
  };
  if (typeof body?.coverImage === 'string') spot.coverImage = body.coverImage.trim();
  if (!spot.name || !spot.category || !spot.summary) return { error: '名称、类别和简介均不能为空' };
  if (spot.name.length > 60) return { error: '景点名称不能超过60个字符' };
  if (spot.category.length > 40) return { error: '景点类别不能超过40个字符' };
  if (spot.summary.length > 1000) return { error: '景点简介不能超过1000个字符' };
  if (spot.coverImage && !isMediaLocation(spot.coverImage)) return { error: '封面图片必须是小程序资源、CloudBase文件ID或HTTPS地址' };
  return { spot };
}

function isMediaLocation(value) {
  return !value || value.startsWith('/images/') || value.startsWith('cloud://') || /^https:\/\//i.test(value);
}

function text(value, limit = 500) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

async function writeAdminLog(transaction, action, targetId, fields) {
  await transaction.collection(ADMIN_LOG_COLLECTION).add({
    data: { action, targetId, fields, createdAt: new Date() },
  });
}

async function updateSpotContent(spotId, body) {
  const validation = validateSpotContent(body);
  if (validation.error) return { validationError: validation.error };
  if (!database) throw new Error('云数据库不可用');
  const { spot: changes } = validation;
  let updatedSpot;
  await database.runTransaction(async (transaction) => {
    const spotsRef = transaction.collection(COLLECTION).doc('spots');
    const detailRef = transaction.collection(COLLECTION).doc(`spotDetails:${spotId}`);
    const [spotsDocument, detailDocument] = await Promise.all([spotsRef.get(), detailRef.get()]);
    const spotsValue = spotsDocument.data?.value;
    const detailValue = detailDocument.data?.value;
    const spots = Array.isArray(spotsValue?.data) ? spotsValue.data : [];
    const index = spots.findIndex((item) => item.id === spotId);
    if (index === -1 || !detailValue?.data) throw new Error('景点不存在或云端资料不完整');
    const currentCoverImage = spots[index].coverImage || '';
    const coverImageChanged = Object.hasOwn(changes, 'coverImage') && changes.coverImage !== currentCoverImage;
    const versionedChanges = coverImageChanged ? { ...changes, previousCoverImage: currentCoverImage } : changes;
    updatedSpot = { ...spots[index], ...versionedChanges };
    const updatedSpots = spots.map((item, itemIndex) => itemIndex === index ? updatedSpot : item);
    await spotsRef.update({ data: { value: { ...spotsValue, data: updatedSpots } } });
    await detailRef.update({ data: { value: { ...detailValue, data: { ...detailValue.data, ...versionedChanges } } } });
    await writeAdminLog(transaction, 'update-spot-content', spotId, Object.keys(versionedChanges));
  });
  cache.loadedAt = 0;
  return { updatedSpot };
}

async function updateHome(body) {
  const heroImages = Array.isArray(body?.heroImages) ? body.heroImages.map((item) => text(item, 600)).filter(Boolean).slice(0, 8) : [];
  const home = {
    heroImage: heroImages[0] || text(body?.heroImage, 600),
    heroImages,
    title: text(body?.title, 60),
    subtitle: text(body?.subtitle, 80),
  };
  if (!home.heroImages.length && home.heroImage) home.heroImages = [home.heroImage];
  if (!home.heroImage || !home.title || !home.subtitle) return { validationError: '首页图片、主标题和副标题均不能为空' };
  if (home.heroImages.some((item) => !isMediaLocation(item))) return { validationError: '首页轮播图片地址格式不正确' };
  if (!database) throw new Error('云数据库不可用');
  await database.runTransaction(async (transaction) => {
    const ref = transaction.collection(COLLECTION).doc('home');
    await ref.set({ data: { value: { data: home } } });
    await writeAdminLog(transaction, 'update-home', 'home', Object.keys(home));
  });
  cache.loadedAt = 0;
  return { home };
}

async function updateNarration(narrationId, body) {
  if (!database) throw new Error('云数据库不可用');
  const current = (await getSnapshot()).snapshot;
  const entry = Object.entries(current.narrations || {}).find(([, resource]) => (resource.data || []).some((item) => item.id === narrationId));
  if (!entry) return { validationError: '讲解资料不存在' };
  const [spotId] = entry;
  const transcript = text(body?.transcript, 4000);
  const audioUrl = text(body?.audioUrl, 600);
  if (!transcript) return { validationError: '讲解文字不能为空' };
  if (audioUrl && !isMediaLocation(audioUrl)) return { validationError: '音频地址必须是CloudBase文件ID或HTTPS地址' };
  let updated;
  await database.runTransaction(async (transaction) => {
    const ref = transaction.collection(COLLECTION).doc(`narrations:${spotId}`);
    const document = await ref.get();
    const value = document.data?.value || { data: [] };
    const items = value.data || [];
    updated = items.find((item) => item.id === narrationId);
    if (!updated) throw new Error('讲解资料不存在');
    updated = {
      ...updated,
      transcript,
      audioUrl,
      audioReady: Boolean(audioUrl),
      audioType: audioUrl ? 'recorded' : 'none',
      reviewStatus: text(body?.reviewStatus, 30) || updated.reviewStatus || 'pending',
      notice: audioUrl ? '正式讲解音频' : '讲解文字已整理，正式音频待录制',
    };
    await ref.update({ data: { value: { ...value, data: items.map((item) => item.id === narrationId ? updated : item) } } });
    await writeAdminLog(transaction, 'update-narration', narrationId, ['transcript', 'audioUrl', 'reviewStatus']);
  });
  cache.loadedAt = 0;
  return { narration: updated };
}

function validateRecommendation(body) {
  const item = {
    id: text(body?.id, 80),
    category: text(body?.category, 30),
    name: text(body?.name, 80),
    type: text(body?.type, 40),
    productName: text(body?.productName, 100),
    description: text(body?.description, 1200),
    address: text(body?.address, 200),
    availability: text(body?.availability, 120),
    phone: text(body?.phone, 40),
    image: text(body?.image, 600),
    linkUrl: text(body?.linkUrl, 600),
    sortOrder: Number.isFinite(Number(body?.sortOrder)) ? Math.max(0, Math.min(9999, Number(body.sortOrder))) : 100,
    status: body?.status === 'online' ? 'online' : 'offline',
  };
  if (!RECOMMENDATION_CATEGORIES.includes(item.category)) return { error: '请选择正确的展示分类' };
  if (!item.name || !item.type) return { error: '商家名称和类型不能为空' };
  if (item.image && !isMediaLocation(item.image)) return { error: '广告图片地址格式不正确' };
  if (item.linkUrl && !/^https:\/\//i.test(item.linkUrl) && !item.linkUrl.startsWith('cloud://')) return { error: '跳转链接请填写HTTPS地址' };
  item.id ||= `${item.category}-${Date.now()}`;
  return { item };
}

async function saveRecommendation(body) {
  const validation = validateRecommendation(body);
  if (validation.error) return { validationError: validation.error };
  if (!database) throw new Error('云数据库不可用');
  const item = validation.item;
  await database.runTransaction(async (transaction) => {
    const ref = transaction.collection(COLLECTION).doc('recommendations');
    const document = await ref.get();
    const value = document.data?.value || {};
    const current = value[item.category]?.data || [];
    const exists = current.some((entry) => entry.id === item.id);
    const data = exists ? current.map((entry) => entry.id === item.id ? item : entry) : [...current, item];
    await ref.update({ data: { value: { ...value, [item.category]: { data } } } });
    await writeAdminLog(transaction, exists ? 'update-recommendation' : 'create-recommendation', item.id, Object.keys(item));
  });
  cache.loadedAt = 0;
  return { item };
}

async function removeRecommendation(itemId) {
  if (!database) throw new Error('云数据库不可用');
  let removed = false;
  await database.runTransaction(async (transaction) => {
    const ref = transaction.collection(COLLECTION).doc('recommendations');
    const document = await ref.get();
    const value = document.data?.value || {};
    const next = { ...value };
    for (const category of RECOMMENDATION_CATEGORIES) {
      const data = value[category]?.data || [];
      if (data.some((item) => item.id === itemId)) {
        next[category] = { data: data.filter((item) => item.id !== itemId) };
        removed = true;
      }
    }
    if (!removed) throw new Error('广告信息不存在');
    await ref.update({ data: { value: next } });
    await writeAdminLog(transaction, 'delete-recommendation', itemId, []);
  });
  cache.loadedAt = 0;
}

async function trackRecommendationAction(body, snapshot) {
  if (!database) throw new Error('云数据库不可用');
  const itemId = text(body?.itemId, 80);
  const action = text(body?.action, 20);
  if (!itemId || !RECOMMENDATION_ACTIONS.includes(action)) return { validationError: '统计事件格式不正确' };
  let recommendations = snapshot.recommendations || {};
  try {
    const latest = await database.collection(COLLECTION).doc('recommendations').get();
    recommendations = latest.data?.value || recommendations;
  } catch (_readError) {}
  const onlineItems = RECOMMENDATION_CATEGORIES.flatMap((category) => (recommendations?.[category]?.data || []).map((item) => ({ ...item, category }))).filter((item) => item.status === 'online');
  const item = onlineItems.find((entry) => entry.id === itemId);
  if (!item) return { validationError: '推荐内容不存在或尚未上架' };
  const day = new Date().toISOString().slice(0, 10);
  const documentId = `${day}_${itemId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const ref = database.collection(RECOMMENDATION_METRICS_COLLECTION).doc(documentId);
  const increment = database.command.inc(1);
  let updateResult;
  try {
    updateResult = await ref.update({ data: { total: increment, [`actions.${action}`]: increment, updatedAt: new Date() } });
  } catch (updateError) {
    if (isMissingCollectionError(updateError)) {
      try { await database.createCollection(RECOMMENDATION_METRICS_COLLECTION); } catch (createError) { if (!/already exists|DATABASE_COLLECTION_EXIST/i.test(String(createError?.message || createError))) throw createError; }
    } else throw updateError;
  }
  if ((Number(updateResult?.stats?.updated) || 0) === 0) {
    await ref.set({ data: { date: day, itemId, itemName: item.name, category: item.category || '', total: 1, actions: { detail: action === 'detail' ? 1 : 0, phone: action === 'phone' ? 1 : 0, link: action === 'link' ? 1 : 0 }, updatedAt: new Date() } });
  }
  return { accepted: true };
}

async function readRecommendationAnalytics(days = 30) {
  if (!database) return { days, total: 0, last7Days: 0, actions: { detail: 0, phone: 0, link: 0 }, items: [], daily: [] };
  const safeDays = Math.max(7, Math.min(90, Number(days) || 30));
  const since = new Date(Date.now() - (safeDays - 1) * 86400000).toISOString().slice(0, 10);
  let result;
  try {
    result = await database.collection(RECOMMENDATION_METRICS_COLLECTION).where({ date: database.command.gte(since) }).limit(1000).get();
  } catch (readError) {
    if (!isMissingCollectionError(readError)) throw readError;
    try { await database.createCollection(RECOMMENDATION_METRICS_COLLECTION); } catch (createError) { if (!/already exists|DATABASE_COLLECTION_EXIST/i.test(String(createError?.message || createError))) throw createError; }
    result = { data: [] };
  }
  const rows = result.data || [];
  const last7Since = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const actions = { detail: 0, phone: 0, link: 0 };
  const itemMap = new Map();
  const dayMap = new Map();
  for (const row of rows) {
    const total = Number(row.total) || 0;
    actions.detail += Number(row.actions?.detail) || 0; actions.phone += Number(row.actions?.phone) || 0; actions.link += Number(row.actions?.link) || 0;
    dayMap.set(row.date, (dayMap.get(row.date) || 0) + total);
    const current = itemMap.get(row.itemId) || { id: row.itemId, name: row.itemName || row.itemId, category: row.category || '', total: 0, detail: 0, phone: 0, link: 0 };
    current.total += total; current.detail += Number(row.actions?.detail) || 0; current.phone += Number(row.actions?.phone) || 0; current.link += Number(row.actions?.link) || 0;
    itemMap.set(row.itemId, current);
  }
  return {
    days: safeDays,
    total: rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0),
    last7Days: rows.filter((row) => row.date >= last7Since).reduce((sum, row) => sum + (Number(row.total) || 0), 0),
    actions,
    items: [...itemMap.values()].sort((a, b) => b.total - a.total),
    daily: [...dayMap.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, total]) => ({ date, total })),
  };
}

function buildAdminDashboard(snapshot) {
  return {
    home: snapshot.home?.data || DEFAULT_HOME,
    spots: snapshot.spots?.data || [],
    narrations: Object.values(snapshot.narrations || {}).flatMap((resource) => resource.data || []).filter((item) => item.languageCode === 'zh-CN'),
    recommendations: RECOMMENDATION_CATEGORIES.flatMap((category) => (snapshot.recommendations?.[category]?.data || []).map((item) => ({ ...item, category }))),
    service: snapshot.service?.data || {},
    routes: snapshot.routes?.data || [],
  };
}

async function createKnowledgeAnswer(question, snapshot) {
  const spots = snapshot.spots?.data || [];
  const craftGuides = Object.fromEntries(Object.entries(snapshot.craftGuides || {})
    .map(([spotId, resource]) => [spotId, resource?.data])
    .filter(([, guide]) => guide));
  const result = await assistant.answerQuestion({
    question,
    input: {
      spots,
      routes: snapshot.routes?.data || [],
      service: snapshot.service?.data || {},
      craftGuides,
      faqs: snapshot.faqs || [],
    },
    provider: assistantProvider,
    requestId: require('node:crypto').randomUUID(),
  });
  return {
    answer: result.answer,
    mode: result.mode,
    sources: resolveKnowledgeSources(result.sourceIds),
    reviewStatus: result.reviewStatus,
    publicStatus: result.publicStatus,
    fallbackReason: result.fallbackReason,
    requestId: result.requestId,
    model: result.model,
    notice: result.notice,
  };
}


async function read(path, method, body, snapshot) {
  if (method === 'GET' && path === '/home') return { data: snapshot.home?.data || DEFAULT_HOME };
  if (method === 'GET' && path === '/spots') return snapshot.spots;
  if (method === 'GET' && path === '/panoramas') return snapshot.panoramas;
  if (method === 'GET' && path === '/service') return snapshot.service;
  if (method === 'GET' && path === '/routes') return snapshot.routes;
  if (method === 'GET' && path === '/site-map') return snapshot.siteMap;
  if (method === 'GET' && path === '/assistant/suggestions') return {
    data: assistantSuggestions,
    meta: {
      maxQuestionLength: 200,
      answerMode: 'controlled-knowledge-base',
      notice: '答案仅来自已登记资料；资料不足时会明确提示待人工核对。',
    },
  };
  if (method === 'POST' && path === '/assistant/chat') {
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question) return { error: { code: 'QUESTION_REQUIRED', message: '请输入问题' } };
    if (question.length > 200) return { error: { code: 'QUESTION_TOO_LONG', message: '问题不能超过200个字符' } };
    return { data: await createKnowledgeAnswer(question, snapshot) };
  }
  const recommendationMatch = path.match(/^\/recommendations\?category=([^&]+)$/);
  if (method === 'GET' && recommendationMatch) return snapshot.recommendations[decodeURIComponent(recommendationMatch[1])] || { data: [] };
  const spotMatch = path.match(/^\/spots\/([^/]+)$/);
  if (method === 'GET' && spotMatch) return snapshot.spotDetails[decodeURIComponent(spotMatch[1])] || null;
  const narrationMatch = path.match(/^\/spots\/([^/]+)\/narrations$/);
  if (method === 'GET' && narrationMatch) return snapshot.narrations[decodeURIComponent(narrationMatch[1])] || null;
  const craftMatch = path.match(/^\/spots\/([^/]+)\/craft-guide$/);
  if (method === 'GET' && craftMatch) return snapshot.craftGuides[decodeURIComponent(craftMatch[1])] || null;
  const panoramaMatch = path.match(/^\/panoramas\/([^/]+)$/);
  if (method === 'GET' && panoramaMatch) return snapshot.panoramaDetails[decodeURIComponent(panoramaMatch[1])] || null;
  return null;
}

exports.main = async (event = {}) => {
  const path = typeof event.path === 'string' ? event.path : '';
  const method = String(event.method || 'GET').toUpperCase();

  if (path === '/admin/session' && method === 'POST') {
    if (!isAdmin(event)) return error('ADMIN_UNAUTHORIZED', '管理口令不正确或尚未配置');
    const { snapshot, source, loadedAt } = await getSnapshot();
    return success({
      data: {
        authorized: true,
        dataSource: source,
        loadedAt: new Date(loadedAt).toISOString(),
        snapshotGeneratedAt: snapshot.meta?.snapshotGeneratedAt || snapshot.generatedAt || '',
        spotCount: Array.isArray(snapshot.spots?.data) ? snapshot.spots.data.length : 0,
        routeCount: Array.isArray(snapshot.routes?.data) ? snapshot.routes.data.length : 0,
      },
    });
  }

  if (path.startsWith('/admin/')) {
    if (!isAdmin(event)) return error('ADMIN_UNAUTHORIZED', '管理口令不正确或尚未配置');
    if (path === '/admin/spots' && method === 'GET') {
      const { snapshot } = await getSnapshot();
      return success({ data: snapshot.spots?.data || [] });
    }
    if (path === '/admin/dashboard' && method === 'GET') {
      const { snapshot } = await getSnapshot();
      return success({ data: buildAdminDashboard(snapshot) });
    }
    if (path === '/admin/recommendation-analytics' && method === 'GET') {
      try {
        return success({ data: await readRecommendationAnalytics(30) });
      } catch (readError) {
        return error('ANALYTICS_READ_FAILED', readError.message || '运营数据读取失败');
      }
    }
    if (path === '/admin/media/images' && method === 'POST') {
      try {
        const result = await uploadAdminImage(event.body);
        if (result.validationError) return error('INVALID_IMAGE_UPLOAD', result.validationError);
        return success({ data: result, uploadedAt: new Date().toISOString() });
      } catch (uploadError) {
        console.error('管理后台图片上传失败：', uploadError);
        return error('ADMIN_UPLOAD_FAILED', uploadError.message || '图片上传失败');
      }
    }
    if (path === '/admin/home' && method === 'PATCH') {
      try {
        const result = await updateHome(event.body);
        if (result.validationError) return error('INVALID_HOME_CONTENT', result.validationError);
        return success({ data: result.home, updatedAt: new Date().toISOString() });
      } catch (writeError) {
        return error('ADMIN_WRITE_FAILED', writeError.message || '首页配置保存失败');
      }
    }
    const spotMatch = path.match(/^\/admin\/spots\/([^/]+)$/);
    if (spotMatch && method === 'PATCH') {
      try {
        const result = await updateSpotContent(decodeURIComponent(spotMatch[1]), event.body);
        if (result.validationError) return error('INVALID_SPOT_CONTENT', result.validationError);
        return success({ data: result.updatedSpot, updatedAt: new Date().toISOString() });
      } catch (writeError) {
        console.error('云端景点保存失败：', writeError);
        return error('ADMIN_WRITE_FAILED', writeError.message || '云端景点保存失败');
      }
    }
    const narrationMatch = path.match(/^\/admin\/narrations\/([^/]+)$/);
    if (narrationMatch && method === 'PATCH') {
      try {
        const result = await updateNarration(decodeURIComponent(narrationMatch[1]), event.body);
        if (result.validationError) return error('INVALID_NARRATION', result.validationError);
        return success({ data: result.narration, updatedAt: new Date().toISOString() });
      } catch (writeError) {
        return error('ADMIN_WRITE_FAILED', writeError.message || '讲解资料保存失败');
      }
    }
    if (path === '/admin/recommendations' && method === 'PUT') {
      try {
        const result = await saveRecommendation(event.body);
        if (result.validationError) return error('INVALID_RECOMMENDATION', result.validationError);
        return success({ data: result.item, updatedAt: new Date().toISOString() });
      } catch (writeError) {
        return error('ADMIN_WRITE_FAILED', writeError.message || '广告信息保存失败');
      }
    }
    const recommendationMatch = path.match(/^\/admin\/recommendations\/([^/]+)$/);
    if (recommendationMatch && method === 'DELETE') {
      try {
        await removeRecommendation(decodeURIComponent(recommendationMatch[1]));
        return success({ data: { removed: true }, updatedAt: new Date().toISOString() });
      } catch (writeError) {
        return error('ADMIN_WRITE_FAILED', writeError.message || '广告信息删除失败');
      }
    }
    return error('NOT_FOUND', '云端管理接口不存在');
  }

  const { snapshot } = await getSnapshot();
  if (path === '/recommendations/track' && method === 'POST') {
    try {
      const result = await trackRecommendationAction(event.body, snapshot);
      if (result.validationError) return error('INVALID_RECOMMENDATION_EVENT', result.validationError);
      return success({ data: result });
    } catch (writeError) {
      console.error('周边推荐统计写入失败：', writeError);
      return error('ANALYTICS_WRITE_FAILED', '统计暂时不可用');
    }
  }
  const response = await read(path, method, event.body, snapshot);
  if (response?.error) return error(response.error.code, response.error.message);
  if (!response) return error('NOT_FOUND', '云端接口不存在或资料尚未配置');
  return success(response);
};
