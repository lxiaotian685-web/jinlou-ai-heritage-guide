import express from 'express';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// 微信播放器的 playbackRate 会改变音高，改用 ffmpeg atempo 预生成保持音色的变速文件。
const AUDIO_SPEEDS = new Set(['0.75', '1.25', '1.5']);
const AUDIO_CACHE_DIR = resolve('data/audio-cache');
import {
  getPanorama,
  getCraftGuide,
  getServiceConfig,
  getSpot,
  listPanoramas,
  listRecommendations,
  listNarrations,
  listAllNarrations,
  listAssistantFaqs,
  updateAssistantFaq,
  updateNarrationReview,
  updateTourRoute,
  listSitePoints,
  listSpots,
  listTourRoutes,
} from './db.js';
import { updateSpotContent } from '../scripts/update-spot.js';
import { updateServiceContent } from '../scripts/update-service.js';
import { createBackup } from '../scripts/backup-db.js';
import {
  assistantSuggestions,
  resolveKnowledgeSources,
  SOURCE_IDS,
} from './knowledge-sources.js';

const recommendationCategories = new Set(['food', 'hotel', 'transport', 'attraction']);

function createKnowledgeAnswer(db, question) {
  const spots = listSpots(db);
  const matchedSpot = spots.find((spot) => question.includes(spot.name.replace(/（.*?）/g, '')));
  const reviewed = (answer, sources) => ({
    answer,
    sources: resolveKnowledgeSources(sources),
    reviewStatus: 'pending-scenic-review',
    publicStatus: 'review-draft',
    statusLabel: '公开资料核对稿 · 待景区审核',
  });
  const pending = (answer) => ({
    answer,
    sources: [],
    reviewStatus: 'information-pending',
    publicStatus: 'not-ready',
    statusLabel: '景区资料待提供',
  });
  const managedFaq = listAssistantFaqs(db).find((faq) => faq.keywords.some((keyword) => question.includes(keyword)));
  if (managedFaq) {
    return {
      answer: managedFaq.answer, sources: resolveKnowledgeSources(managedFaq.sources),
      reviewStatus: managedFaq.reviewStatus, publicStatus: managedFaq.publicStatus,
      statusLabel: managedFaq.publicStatus === 'public' ? '景区已审核' : '公开资料核对稿 · 待景区审核',
    };
  }
  if (/拍照|摄影|录像|闪光灯|三脚架/.test(question)) {
    return pending('未找到可靠资料：当前资料尚未确认景区的拍照、录像、闪光灯和三脚架规定。请以现场标识和工作人员要求为准。');
  }
  if (/停车|停车场|车停/.test(question)) {
    return pending('未找到可靠资料：当前资料尚未确认景区停车场位置、开放时间和收费规则。请在出发前通过景区最新公开渠道确认。');
  }
  if (/老人|老年|儿童|小孩|轮椅|无障碍|婴儿车/.test(question)) {
    return pending('未找到可靠资料：老人、儿童、轮椅和婴儿车的场内通行路线及无障碍设施尚待景区确认。到场后请优先咨询工作人员，并以现场开放区域为准。');
  }
  if (/门票|票价|购票|订票|优惠|免费/.test(question)) {
    const service = getServiceConfig(db);
    if (!service.ticket.enabled) return pending('未找到可靠资料：官方订票入口、当前票价和优惠政策尚未配置。请通过景区最新公开渠道确认，避免按过期资料安排行程。');
    return reviewed('可通过已配置的官方入口购票；具体票价和优惠资格以购票页面及景区当日公告为准。', [SOURCE_IDS.PROJECT_SERVICE_CONFIG]);
  }
  if (/开放|几点|营业|闭馆|停止入园/.test(question)) {
    const service = getServiceConfig(db);
    if (/待|为准|未配置|未接入/.test(service.openingHours)) return pending('未找到可靠资料：景区开放时间、停止入园时间和节假日调整尚待景区确认，请以景区当日公告为准。');
    return reviewed(`当前项目记录的开放时段为${service.openingHours}。临时闭馆、停止入园时间和节假日调整请以景区当日公告为准。`, [SOURCE_IDS.PROJECT_SERVICE_CONFIG]);
  }
  if (/交通|怎么去|地址|公交|地铁|自驾|坐车|乘车/.test(question)) {
    const service = getServiceConfig(db);
    if (/待|未配置|未接入/.test(`${service.address}${service.transport}`)) return pending('未找到可靠资料：景区准确地址和公共交通、停车信息尚待景区确认，请通过实时地图和景区最新公开渠道规划出行。');
    return reviewed(`地址：${service.address}。交通参考：${service.transport}。出发时请结合实时地图规划路线。`, [SOURCE_IDS.PROJECT_SERVICE_CONFIG]);
  }
  if (/建议.*时间|游览.*多久|逛.*多久|需要多久|多长时间/.test(question)) {
    const routes = listTourRoutes(db);
    return reviewed(`当前${routes.length}条路线的用时均为参考值：${routes.map((route) => `${route.name}${route.duration}`).join('；')}。实际用时会受停留、讲解和现场开放情况影响。`, [SOURCE_IDS.PROJECT_ROUTE_PLAN]);
  }
  if (/路线|怎么游|游览/.test(question)) {
    const routes = listTourRoutes(db);
    return reviewed(`目前有${routes.length}条参考路线：${routes.map((route) => route.name).join('、')}。这些路线仍需景区确认和现场实走，请在“推荐路线”页面查看各站点。`, [SOURCE_IDS.PROJECT_ROUTE_PLAN]);
  }
  if (/电话|联系|咨询/.test(question)) {
    const service = getServiceConfig(db);
    if (/待|未配置|未接入/.test(service.phone)) return pending('未找到可靠资料：景区联系电话尚待确认，请以景区最新公开渠道为准。');
    return reviewed(`当前项目记录的景区联系电话为${service.phone}。票务、停车、临时开放和特殊通行安排建议直接致电确认。`, [SOURCE_IDS.PROJECT_SERVICE_CONFIG]);
  }
  if (/木雕|工艺/.test(question)) {
    return reviewed('金楼内的花罩、帘架、藻井和天花等木雕构件，运用了浮雕、线刻、镂雕及玻璃镶嵌等技法，并有泥金和贴金装饰。具体纹样寓意仍以景区展签和审核资料为准。', [SOURCE_IDS.SHUNDE_MUSEUM_JINLOU, SOURCE_IDS.PROJECT_CRAFT_GUIDE]);
  }
  if (/为什么叫|名字由来|名称由来/.test(question)) {
    return reviewed('公开资料可确认金楼原名赋鹤楼，楼内木雕构件大量采用泥金、贴金装饰。“金楼”名称的完整沿革仍待景区审核。', [SOURCE_IDS.SHUNDE_MUSEUM_JINLOU]);
  }
  if (/年代|建于|始建|什么时候建|历史多久/.test(question)) {
    return reviewed('顺德区博物馆公开资料记载，金楼是清嘉庆、道光年间苏丕文所建的藏书楼。景区其他建筑的具体始建、重修年代不能一概而论。', [SOURCE_IDS.SHUNDE_MUSEUM_JINLOU]);
  }
  if (/人物|谁建|主人|苏丕文|名人/.test(question)) {
    return reviewed('顺德区博物馆资料记载，金楼原名赋鹤楼，是苏丕文所建的藏书楼。其他人物故事及传说仍需景区逐项审核后再补充。', [SOURCE_IDS.SHUNDE_MUSEUM_JINLOU]);
  }
  if (/看点|值得看|重点|特色|推荐看/.test(question)) {
    return reviewed('建议重点观察金楼的饰金木雕与花罩、帘架、藻井等构件。公开田野资料还提到古建筑群包含职方第、亦渔遗塾等建筑；各点细节仍以景区审核资料为准。', [SOURCE_IDS.SHUNDE_MUSEUM_JINLOU, SOURCE_IDS.SYSU_FIELD_STUDY]);
  }
  if (matchedSpot) {
    const sources = [SOURCE_IDS.PROJECT_SPOT_RECORDS];
    if (matchedSpot.id === 'jinlou') sources.unshift(SOURCE_IDS.SHUNDE_MUSEUM_JINLOU);
    return reviewed(`${matchedSpot.name}属于“${matchedSpot.category}”。${matchedSpot.summary}`, sources);
  }
  return pending('未找到可靠资料。你可以改问某个景点、金楼名称与年代、重点看点、游览路线或木雕工艺；票务、开放和通行政策须以景区最新公告为准。');
}

export function createApp(db, options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.get('/media/narrations/:filename', (request, response, next) => {
    const rate = String(request.query.rate || '');
    if (!AUDIO_SPEEDS.has(rate)) return next();
    const filename = String(request.params.filename || '');
    if (!/^[a-z0-9-]+-(zh|yue|en)\.wav$/.test(filename)) return response.status(404).end();
    const source = resolve('public/media/narrations', filename);
    if (!existsSync(source)) return response.status(404).end();
    const cacheDirectory = options.audioCacheDir || AUDIO_CACHE_DIR;
    const cachePath = resolve(cacheDirectory, filename.replace(/\.wav$/, `-${rate}.wav`));
    if (!existsSync(cachePath)) {
      mkdirSync(cacheDirectory, { recursive: true });
      const conversion = spawnSync(options.ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', source,
        '-filter:a', `atempo=${rate}`,
        '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', cachePath,
      ], { stdio: 'ignore' });
      if (conversion.error?.code === 'ENOENT') {
        return response.status(503).json({ error: { code: 'AUDIO_SPEED_UNAVAILABLE', message: '当前环境缺少 ffmpeg，无法生成保持音高的变速音频' } });
      }
      if (conversion.status !== 0) {
        return response.status(500).json({ error: { code: 'AUDIO_SPEED_FAILED', message: '生成变速音频失败' } });
      }
    }
    return response.sendFile(cachePath);
  });
  app.use('/media', express.static(resolve('public/media')));

  const adminToken = options.adminToken || '';
  const backupBeforeAdminWrite = () => {
    if (!options.databasePath || !options.backupDirectory) return '';
    return createBackup({ databasePath: options.databasePath, backupDirectory: options.backupDirectory }).backupPath;
  };
  const requireAdmin = (request, response, next) => {
    if (!adminToken) {
      return response.status(503).json({ error: { code: 'ADMIN_DISABLED', message: '内容管理尚未配置口令' } });
    }
    if (request.get('x-admin-token') !== adminToken) {
      return response.status(401).json({ error: { code: 'ADMIN_UNAUTHORIZED', message: '管理口令不正确' } });
    }
    return next();
  };

  app.get('/admin', (_request, response) => {
    response.sendFile(resolve('public/admin.html'));
  });

  app.get('/api/v1/admin/spots', requireAdmin, (_request, response) => {
    response.json({ data: listSpots(db) });
  });

  app.patch('/api/v1/admin/spots/:id', requireAdmin, (request, response) => {
    try {
      const result = updateSpotContent({
        databasePath: options.databasePath,
        backupDirectory: options.backupDirectory,
        spotId: request.params.id,
        changes: request.body,
      });
      return response.json({
        data: result.after,
        meta: { changed: result.changed, backupCreated: Boolean(result.backupPath) },
      });
    } catch (error) {
      return response.status(400).json({ error: { code: 'CONTENT_UPDATE_FAILED', message: error.message } });
    }
  });

  app.get('/api/v1/admin/dashboard', requireAdmin, (_request, response) => {
    const narrations = listAllNarrations(db);
    response.json({ data: {
      service: getServiceConfig(db), routes: listTourRoutes(db), narrations, faqs: listAssistantFaqs(db),
      gaps: [
        { id: 'official-map', label: '官方高清地图与入口出口', ready: false },
        { id: 'authorized-images', label: '15景点授权图片', ready: false },
        { id: 'formal-audio', label: '正式人工配音', ready: narrations.some((item) => item.audioType === 'recorded' && item.reviewStatus === 'approved' && item.audioUrl) },
        { id: 'ticket', label: '官方订票入口', ready: getServiceConfig(db).ticket.enabled },
        { id: 'panorama', label: '真实360全景', ready: false },
      ],
    } });
  });

  app.patch('/api/v1/admin/service', requireAdmin, (request, response) => {
    try {
      const result = updateServiceContent({ databasePath: options.databasePath, backupDirectory: options.backupDirectory, changes: request.body });
      return response.json({ data: result.after, meta: { changed: result.changed, backupCreated: Boolean(result.backupPath) } });
    } catch (error) { return response.status(400).json({ error: { code: 'SERVICE_UPDATE_FAILED', message: error.message } }); }
  });

  app.patch('/api/v1/admin/routes/:id', requireAdmin, (request, response) => {
    try {
      const backupPath = backupBeforeAdminWrite();
      const route = updateTourRoute(db, request.params.id, request.body || {});
      if (!route) return response.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: '未找到该路线' } });
      return response.json({ data: route, meta: { backupCreated: Boolean(backupPath) } });
    } catch (error) { return response.status(400).json({ error: { code: 'ROUTE_UPDATE_FAILED', message: error.message } }); }
  });

  app.patch('/api/v1/admin/narrations/:id', requireAdmin, (request, response) => {
    try {
      const backupPath = backupBeforeAdminWrite();
      const changed = updateNarrationReview(db, request.params.id, request.body?.reviewStatus);
      if (!changed) return response.status(404).json({ error: { code: 'NARRATION_NOT_FOUND', message: '未找到该讲解' } });
      return response.json({ data: { id: request.params.id, reviewStatus: request.body.reviewStatus }, meta: { backupCreated: Boolean(backupPath) } });
    } catch (error) { return response.status(400).json({ error: { code: 'NARRATION_UPDATE_FAILED', message: error.message } }); }
  });

  app.patch('/api/v1/admin/faqs/:id', requireAdmin, (request, response) => {
    try {
      const backupPath = backupBeforeAdminWrite();
      const faq = updateAssistantFaq(db, request.params.id, request.body || {});
      if (!faq) return response.status(404).json({ error: { code: 'FAQ_NOT_FOUND', message: '未找到该问答' } });
      return response.json({ data: faq, meta: { backupCreated: Boolean(backupPath) } });
    } catch (error) { return response.status(400).json({ error: { code: 'FAQ_UPDATE_FAILED', message: error.message } }); }
  });

  app.get('/api/v1/health', (_request, response) => {
    response.json({ status: 'ok', service: 'bijiang-explorer-api' });
  });

  app.get('/api/v1/spots', (_request, response) => {
    response.json({ data: listSpots(db) });
  });

  app.get('/api/v1/spots/:id', (request, response) => {
    const spot = getSpot(db, request.params.id);
    if (!spot) return response.status(404).json({ error: { code: 'SPOT_NOT_FOUND', message: '未找到该景点' } });
    return response.json({ data: spot });
  });

  app.get('/api/v1/spots/:id/narrations', (request, response) => {
    const spot = getSpot(db, request.params.id);
    if (!spot) return response.status(404).json({ error: { code: 'SPOT_NOT_FOUND', message: '未找到该景点' } });
    return response.json({ data: listNarrations(db, request.params.id) });
  });

  app.get('/api/v1/spots/:id/craft-guide', (request, response) => {
    const spot = getSpot(db, request.params.id);
    if (!spot) return response.status(404).json({ error: { code: 'SPOT_NOT_FOUND', message: '未找到该景点' } });
    const guide = getCraftGuide(db, request.params.id);
    if (!guide) return response.status(404).json({ error: { code: 'CRAFT_GUIDE_NOT_FOUND', message: '该景点暂无工艺图解' } });
    return response.json({ data: guide });
  });

  app.get('/api/v1/panoramas', (_request, response) => {
    response.json({ data: listPanoramas(db) });
  });

  app.get('/api/v1/panoramas/:id', (request, response) => {
    const panorama = getPanorama(db, request.params.id);
    if (!panorama) {
      return response.status(404).json({ error: { code: 'PANORAMA_NOT_FOUND', message: '未找到该全景场景' } });
    }
    return response.json({ data: panorama });
  });

  app.get('/api/v1/service', (_request, response) => {
    response.json({ data: getServiceConfig(db) });
  });

  app.get('/api/v1/recommendations', (request, response) => {
    const category = request.query.category;
    if (category && !recommendationCategories.has(category)) {
      return response.status(400).json({ error: { code: 'INVALID_CATEGORY', message: '不支持的推荐分类' } });
    }
    return response.json({ data: listRecommendations(db, category) });
  });

  app.get('/api/v1/assistant/suggestions', (_request, response) => {
    response.json({
      data: assistantSuggestions,
      meta: {
        maxQuestionLength: 200,
        answerMode: 'controlled-knowledge-base',
        notice: '答案仅来自已登记资料；资料不足时会明确提示待人工核对。',
      },
    });
  });

  app.post('/api/v1/assistant/chat', (request, response) => {
    const question = typeof request.body?.question === 'string' ? request.body.question.trim() : '';
    if (!question) {
      return response.status(400).json({ error: { code: 'QUESTION_REQUIRED', message: '请输入问题' } });
    }
    if (question.length > 200) {
      return response.status(400).json({ error: { code: 'QUESTION_TOO_LONG', message: '问题不能超过200个字符' } });
    }
    const result = createKnowledgeAnswer(db, question);
    return response.json({
      data: {
        answer: result.answer,
        mode: 'knowledge-base',
        sources: result.sources,
        reviewStatus: result.reviewStatus,
        publicStatus: result.publicStatus,
        notice: result.statusLabel,
      },
    });
  });

  app.get('/api/v1/routes', (_request, response) => {
    const routes = listTourRoutes(db).map((route) => ({
      ...route,
      verificationStatus: 'pending-field-check',
      verificationLabel: '资料参考',
      passageNotice: '请以现场指示和工作人员安排为准；遇临时关闭时不要进入。',
    }));
    response.json({
      data: routes,
      meta: {
        verified: false,
        evidenceLevel: 'research-backed',
        statusLabel: '路线待景区确认',
        entranceExitVerified: false,
        accessibilityVerified: false,
        lastReviewed: '2026-09-17',
        notice: '1—15仅为景点编号，不代表游览顺序；经典线参考公开游客实走记录，其余为主题建议，均须景区确认与现场实走',
        safetyNotice: '入口、出口、单向通行、临时关闭和无障碍路线尚无可公开核验的景区资料，请以现场公告和工作人员指引为准。',
        sources: [
          { title: '碧江金楼景区现场景点分布牌', url: '' },
          { title: '顺德区博物馆：碧江金楼', url: 'https://www.sdmuseum.com.cn/unmoveabledetail.html?id=1551' },
          { title: '中山大学历史学系：碧江金楼古建筑群田野考察', url: 'https://history.sysu.edu.cn/article/1296' },
          { title: '实地游客路线参考', url: 'https://sg.trip.com/moments/poi-bijiang-golden-house-88733/' },
        ],
      },
    });
  });

  app.get('/api/v1/site-map', (_request, response) => {
    response.json({
      data: listSitePoints(db),
      meta: {
        source: '碧江金楼景区现场景点分布牌（用户现场拍摄）',
        coordinateType: 'normalized-layout',
        officialMap: false,
        positionVerified: false,
        entranceExitVerified: false,
        lastReviewed: '2026-09-17',
        notice: '当前为手绘布局示意；点位根据现场牌转录为页面相对位置，不是经纬度，不能用于导航。入口、出口和无障碍通道待景区提供。',
      },
    });
  });

  app.use((_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: '接口不存在' } });
  });

  return app;
}
