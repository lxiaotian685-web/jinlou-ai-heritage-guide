import express from 'express';
import { randomUUID } from 'node:crypto';
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
import {
  assistantSuggestions,
  resolveKnowledgeSources,
  SOURCE_IDS,
} from './knowledge-sources.js';
import assistantCore from '../../frontend/cloudfunctions/bijiang-api/assistant/index.js';

const recommendationCategories = new Set(['food', 'hotel', 'transport', 'attraction']);

function buildAssistantInput(db) {
  const spots = listSpots(db);
  const craftGuides = {};
  for (const spot of spots) {
    const guide = getCraftGuide(db, spot.id);
    if (guide) craftGuides[spot.id] = guide;
  }
  return {
    spots,
    routes: listTourRoutes(db),
    service: getServiceConfig(db),
    craftGuides,
    faqs: listAssistantFaqs(db),
  };
}


export function createApp(db, options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use('/media', express.static(resolve('public/media')));

  const adminToken = options.adminToken || '';
  const assistantProvider = options.assistantProvider || assistantCore.selectProvider(process.env);
  const assistantRateLimiter = options.assistantRateLimiter || assistantCore.createRateLimiter({
    perMinute: Number(process.env.ASSISTANT_RATE_LIMIT_PER_MINUTE) || 60,
    perDay: Number(process.env.ASSISTANT_RATE_LIMIT_PER_DAY) || 300,
  });
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
        notice: '答案仅来自已整理资料；资料不足时会明确提示暂未收录。',
      },
    });
  });

  app.post('/api/v1/assistant/chat', async (request, response) => {
    const question = typeof request.body?.question === 'string' ? request.body.question.trim() : '';
    if (!question) {
      return response.status(400).json({ error: { code: 'QUESTION_REQUIRED', message: '请输入问题' } });
    }
    if (question.length > 200) {
      return response.status(400).json({ error: { code: 'QUESTION_TOO_LONG', message: '问题不能超过200个字符' } });
    }
    const result = await assistantCore.answerQuestion({
      question,
      input: buildAssistantInput(db),
      provider: assistantProvider,
      requestId: randomUUID(),
      clientKey: request.ip || 'anonymous',
      rateLimiter: assistantRateLimiter,
    });
    return response.json({
      data: {
        answer: result.answer,
        mode: result.mode,
        sources: resolveKnowledgeSources(result.sourceIds),
        reviewStatus: result.reviewStatus,
        publicStatus: result.publicStatus,
        fallbackReason: result.fallbackReason,
        requestId: result.requestId,
        model: result.model,
        notice: result.notice,
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
