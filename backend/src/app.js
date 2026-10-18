import express from 'express';
import { resolve } from 'node:path';
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

const recommendationCategories = new Set(['food', 'hotel', 'transport', 'attraction']);

function createKnowledgeAnswer(db, question) {
  const spots = listSpots(db);
  const matchedSpot = spots.find((spot) => question.includes(spot.name.replace(/（.*?）/g, '')));
  const reviewed = (answer, sources) => ({
    answer,
    sources,
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
      answer: managedFaq.answer, sources: managedFaq.sources,
      reviewStatus: managedFaq.reviewStatus, publicStatus: managedFaq.publicStatus,
      statusLabel: managedFaq.publicStatus === 'public' ? '景区已审核' : '公开资料核对稿 · 待景区审核',
    };
  }
  if (/拍照|摄影|录像|闪光灯|三脚架/.test(question)) {
    return pending('当前资料尚未确认景区的拍照、录像、闪光灯和三脚架规定。请以现场标识和工作人员要求为准。');
  }
  if (/停车|停车场|车停/.test(question)) {
    return pending('当前资料尚未确认景区停车场位置、开放时间和收费规则。建议出发前拨打景区电话0757-26632123确认。');
  }
  if (/老人|老年|儿童|小孩|轮椅|无障碍|婴儿车/.test(question)) {
    return pending('老人、儿童、轮椅和婴儿车的场内通行路线及无障碍设施尚待景区确认。到场后请优先咨询工作人员，并以现场开放区域为准。');
  }
  if (/门票|票价|购票|订票|优惠|免费/.test(question)) {
    const service = getServiceConfig(db);
    if (!service.ticket.enabled) return pending(`官方订票入口、当前票价和优惠政策尚未配置。可拨打景区电话${service.phone}确认，避免按过期资料安排行程。`);
    return reviewed(`可通过已配置的官方入口购票；具体票价和优惠资格以购票页面及景区当日公告为准。`, ['当前服务信息资料库']);
  }
  if (/开放|几点|营业|闭馆|停止入园/.test(question)) {
    const service = getServiceConfig(db);
    return reviewed(`当前记录的开放时段为${service.openingHours}。临时闭馆、停止入园时间和节假日调整请以景区当日公告为准，也可拨打${service.phone}确认。`, ['当前服务信息资料库']);
  }
  if (/交通|怎么去|地址|公交|地铁|自驾|坐车|乘车/.test(question)) {
    const service = getServiceConfig(db);
    return reviewed(`地址：${service.address}。交通参考：${service.transport}。出发时请结合实时地图规划路线。`, ['当前服务信息资料库']);
  }
  if (/建议.*时间|游览.*多久|逛.*多久|需要多久|多长时间/.test(question)) {
    const routes = listTourRoutes(db);
    return reviewed(`当前${routes.length}条路线的用时均为参考值：${routes.map((route) => `${route.name}${route.duration}`).join('；')}。实际用时会受停留、讲解和现场开放情况影响。`, ['当前推荐路线资料库']);
  }
  if (/路线|怎么游|游览/.test(question)) {
    const routes = listTourRoutes(db);
    return reviewed(`目前有${routes.length}条参考路线：${routes.map((route) => route.name).join('、')}。这些路线仍需景区确认和现场实走，请在“推荐路线”页面查看各站点。`, ['当前推荐路线资料库']);
  }
  if (/电话|联系|咨询/.test(question)) {
    const service = getServiceConfig(db);
    return reviewed(`景区联系电话为${service.phone}。票务、停车、临时开放和特殊通行安排建议直接致电确认。`, ['当前服务信息资料库']);
  }
  if (/木雕|工艺/.test(question)) {
    return reviewed('金楼内的花罩、帘架、藻井和天花等木雕构件，运用了浮雕、线刻、镂雕及玻璃镶嵌等技法，并有泥金和贴金装饰。具体纹样寓意仍以景区展签和审核资料为准。', ['当前景点资料库', '当前工艺导览资料']);
  }
  if (/为什么叫|名字由来|名称由来/.test(question)) {
    return reviewed('金楼原名赋鹤楼，名称“金楼”与楼内木雕构件采用泥金、贴金装饰有关。更完整的名称沿革仍待景区审核。', ['当前景点资料库']);
  }
  if (/年代|建于|始建|什么时候建|历史多久/.test(question)) {
    return reviewed('现有资料可确认：泥楼始建于明代；职方第建于清嘉庆、道光年间；景区其他建筑的具体始建、重修年代不能一概而论，应分别以景区审核资料和文物说明为准。', ['当前景点资料库']);
  }
  if (/人物|谁建|主人|苏丕文|名人/.test(question)) {
    return reviewed('当前资料可确认的重要人物是苏丕文：职方第为其宅第，金楼原名赋鹤楼，是其所建的藏书楼。其他人物故事及传说仍需景区逐项审核后再补充。', ['当前景点资料库']);
  }
  if (/看点|值得看|重点|特色|推荐看/.test(question)) {
    return reviewed('建议重点观察金楼的饰金木雕与花罩、帘架、藻井等构件，也可结合泥楼的夯筑墙体与中西合璧细部、职方第的宅第格局、亦渔遗塾的耕读空间和后花园的亭廊水景进行游览。', ['当前景点资料库']);
  }
  if (matchedSpot) {
    return reviewed(`${matchedSpot.name}属于“${matchedSpot.category}”。${matchedSpot.summary}`, ['当前景点资料库']);
  }
  return pending('当前资料库还没有这个问题的可靠答案。你可以询问某个景点、名称由来、建筑年代、重点看点、游览路线、开放时间、地址交通或木雕工艺。');
}

export function createApp(db, options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
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
        { id: 'formal-audio', label: '正式人工配音', ready: narrations.some((item) => item.audioUrl) },
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
