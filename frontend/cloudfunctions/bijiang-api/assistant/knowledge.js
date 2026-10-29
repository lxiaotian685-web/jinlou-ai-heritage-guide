const SOURCE_IDS = Object.freeze({
  SHUNDE_MUSEUM_JINLOU: 'shunde-museum-jinlou',
  SYSU_FIELD_STUDY: 'sysu-bijiang-field-study',
  PROJECT_SPOT_RECORDS: 'project-spot-records',
  PROJECT_CRAFT_GUIDE: 'project-craft-guide',
  PROJECT_SERVICE_CONFIG: 'project-service-config',
  PROJECT_ROUTE_PLAN: 'project-route-plan',
});

const PENDING_PATTERN = /待|未配置|未接入|为准|尚未/;

function normalize(value) {
  return String(value || '')
    .replace(/[\s，。！？、；：""''（）()【】\[\]?.,!;:~·—\-]/g, '')
    .toLowerCase();
}

function isPending(value) {
  return !value || PENDING_PATTERN.test(String(value));
}

function routeDuration(value) {
  const text = String(value || '').trim();
  return !text || /待现场|待实测|待确认/.test(text) ? '建议按兴趣和停留时间安排' : text;
}

function routeTheme(value) {
  return String(value || '主题路线')
    .replace('参考公开游客实走记录，顺序待景区确认', '串联碧江金楼主要参观点')
    .replace(/待景区确认|待现场实走/g, '结合现场开放情况调整');
}

function bigramOverlap(question, content) {
  if (question.length < 2 || content.length < 2) return 0;
  const grams = new Set();
  for (let i = 0; i < question.length - 1; i += 1) grams.add(question.slice(i, i + 2));
  let hit = 0;
  for (let i = 0; i < content.length - 1; i += 1) {
    if (grams.has(content.slice(i, i + 2))) hit += 1;
  }
  return Math.min(1, hit / Math.max(1, grams.size));
}

function buildKnowledgeItems({ spots = [], routes = [], service = {}, craftGuides = {}, faqs = [], updatedAt = '' } = {}) {
  const items = [];
  const stamp = updatedAt || new Date().toISOString().slice(0, 10);
  const spotNames = new Map(spots.map((spot) => [spot.id, spot.name]));

  for (const spot of spots) {
    const sourceIds = spot.id === 'jinlou'
      ? [SOURCE_IDS.SHUNDE_MUSEUM_JINLOU, SOURCE_IDS.PROJECT_SPOT_RECORDS]
      : [SOURCE_IDS.PROJECT_SPOT_RECORDS];
    items.push({
      id: `spot:${spot.id}`,
      category: 'spot',
      title: spot.name,
      content: `${spot.name}属于“${spot.category}”。${spot.summary}`,
      keywords: [String(spot.name || '').replace(/（.*?）/g, ''), spot.category].filter(Boolean),
      sourceId: sourceIds[0],
      sourceIds,
      sourceName: '',
      sourceUrl: '',
      reviewStatus: 'pending-scenic-review',
      updatedAt: stamp,
    });
  }

  for (const route of routes) {
    const stops = Array.isArray(route.stops) ? route.stops.filter(Boolean) : [];
    items.push({
      id: `route:${route.id}`,
      category: 'route',
      title: `推荐路线：${route.name}`,
      content: `${route.name}，${routeTheme(route.theme)}，参考用时${routeDuration(route.duration)}。${stops.length ? `途经：${stops.join('、')}。` : ''}请结合现场开放情况灵活调整。`,
      keywords: [route.name, route.theme, '路线', '游线', '怎么游', '游览顺序'].filter(Boolean),
      sourceId: SOURCE_IDS.PROJECT_ROUTE_PLAN,
      sourceIds: [SOURCE_IDS.PROJECT_ROUTE_PLAN],
      sourceName: '',
      sourceUrl: '',
      reviewStatus: 'pending-field-check',
      updatedAt: stamp,
    });
  }

  const serviceFields = [
    ['address', '景区地址', ['地址', '在哪里', '位置', '怎么去']],
    ['openingHours', '开放时间', ['开放', '几点', '营业', '闭馆', '停止入园']],
    ['phone', '联系电话', ['电话', '联系', '咨询']],
    ['transport', '交通方式', ['交通', '公交', '地铁', '自驾', '坐车', '乘车']],
  ];
  for (const [field, title, keywords] of serviceFields) {
    const value = service?.[field];
    items.push({
      id: `service:${field}`,
      category: 'service',
      title,
      content: isPending(value) ? `${title}尚未获得景区确认，请以现场公告和景区最新公开渠道为准。` : `${title}：${value}`,
      keywords,
      sourceId: SOURCE_IDS.PROJECT_SERVICE_CONFIG,
      sourceIds: [SOURCE_IDS.PROJECT_SERVICE_CONFIG],
      sourceName: '',
      sourceUrl: '',
      reviewStatus: 'pending-scenic-review',
      updatedAt: stamp,
    });
  }
  if (service?.ticket?.enabled) {
    items.push({
      id: 'service:ticket',
      category: 'service',
      title: '门票与购票',
      content: '可通过已配置的官方入口购票；具体票价、优惠资格与当日政策以购票页面和景区公告为准。',
      keywords: ['门票', '票价', '购票', '订票', '优惠', '免费'],
      sourceId: SOURCE_IDS.PROJECT_SERVICE_CONFIG,
      sourceIds: [SOURCE_IDS.PROJECT_SERVICE_CONFIG],
      sourceName: '',
      sourceUrl: service.ticket.url || '',
      reviewStatus: 'pending-scenic-review',
      updatedAt: stamp,
    });
  }

  for (const [spotId, guide] of Object.entries(craftGuides || {})) {
    if (!guide) continue;
    const steps = Array.isArray(guide.steps) ? guide.steps : [];
    const spotName = spotNames.get(spotId) || guide.title || spotId;
    items.push({
      id: `craft:${spotId}`,
      category: 'craft',
      title: `${spotName}木雕工艺`,
      content: `${guide.summary || ''}${steps.map((step) => `${step.title}：${step.description}`).join('；')}`,
      keywords: [spotName, '木雕', '工艺', '雕刻', '饰金', '花罩', '藻井'].filter(Boolean),
      sourceId: SOURCE_IDS.PROJECT_CRAFT_GUIDE,
      sourceIds: spotId === 'jinlou'
        ? [SOURCE_IDS.SHUNDE_MUSEUM_JINLOU, SOURCE_IDS.PROJECT_CRAFT_GUIDE]
        : [SOURCE_IDS.PROJECT_CRAFT_GUIDE],
      sourceName: '',
      sourceUrl: '',
      reviewStatus: 'pending-expert-review',
      updatedAt: stamp,
    });
  }

  for (const faq of faqs) {
    items.push({
      id: `faq:${faq.id}`,
      category: 'faq',
      title: faq.question,
      content: faq.answer,
      keywords: faq.keywords || [],
      sourceId: (faq.sources || [])[0] || SOURCE_IDS.PROJECT_SPOT_RECORDS,
      sourceIds: faq.sources || [],
      sourceName: '',
      sourceUrl: '',
      reviewStatus: faq.reviewStatus || 'pending-scenic-review',
      publicStatus: faq.publicStatus || 'review-draft',
      updatedAt: stamp,
    });
  }

  return items;
}

function categoryRank(category) {
  if (category === 'craft' || category === 'faq') return 3;
  if (category === 'route') return 2;
  return 1;
}

function retrieve(items, question, limit = 3) {
  const normalizedQuestion = normalize(question);
  if (!normalizedQuestion) return [];
  const scored = items
    .filter((item) => item.category !== 'service')
    .map((item) => {
      let score = 0;
      let reason = '';
      const title = normalize(item.title);
      if (title && normalizedQuestion.includes(title)) {
        score += 12;
        reason = '标题精确匹配';
      }
      const hits = (item.keywords || []).filter((keyword) => {
        const normalizedKeyword = normalize(keyword);
        return normalizedKeyword && normalizedQuestion.includes(normalizedKeyword);
      });
      if (hits.length) {
        score += Math.min(12, 4 + hits.length * 4);
        if (!reason) reason = `关键词命中：${hits.join('、')}`;
      }
      const overlap = bigramOverlap(normalizedQuestion, normalize(`${item.title}${item.content}`));
      if (overlap > 0) {
        score += Math.round(overlap * 8);
        if (!reason) reason = '正文相关';
      }
      if (score > 0 && (item.category === 'craft' || item.category === 'faq')) score += 4;
      return { item, score, reason };
    })
    .filter((result) => result.score >= 8)
    .sort((left, right) => right.score - left.score || categoryRank(right.item.category) - categoryRank(left.item.category));
  const hasSpecificMatch = scored.some((result) => result.item.category === 'craft' || result.item.category === 'faq');
  const ranked = hasSpecificMatch ? scored.filter((result) => result.item.category !== 'spot') : scored;
  return ranked.slice(0, limit);
}

function fixedFact({ service = {}, routes = [] }, question) {
  if (/拍照|摄影|录像|闪光灯|三脚架/.test(question)) {
    return { missing: '资料库暂未收录拍照、录像、闪光灯和三脚架的具体规定，请以现场标识和工作人员要求为准。' };
  }
  if (/停车|停车场|车停/.test(question)) {
    return { missing: '资料库暂未收录停车场位置、开放时间和收费规则，请在出发前通过景区公开渠道或地图服务确认。' };
  }
  if (/老人|老年|儿童|小孩|轮椅|无障碍|婴儿车/.test(question)) {
    return { missing: '资料库暂未收录老人、儿童、轮椅和婴儿车的完整通行说明。到场后请优先咨询工作人员，并以现场开放区域为准。' };
  }
  if (/门票|票价|购票|订票|优惠|免费/.test(question)) {
    if (!service?.ticket?.enabled) {
      return { missing: '未找到可靠资料：官方订票入口、当前票价和优惠政策尚未配置。请通过景区最新公开渠道确认，避免按过期资料安排行程。' };
    }
    return { answer: '可通过已配置的官方入口购票；具体票价和优惠资格以购票页面及景区当日公告为准。', sourceIds: [SOURCE_IDS.PROJECT_SERVICE_CONFIG] };
  }
  if (/开放|几点|营业|闭馆|停止入园/.test(question)) {
    if (isPending(service.openingHours)) {
      return { missing: '资料库暂未收录当前开放时间、停止入园时间和节假日调整，请以景区当日公告为准。' };
    }
    return { answer: `当前项目记录的开放时段为${service.openingHours}。临时闭馆、停止入园时间和节假日调整请以景区当日公告为准。`, sourceIds: [SOURCE_IDS.PROJECT_SERVICE_CONFIG] };
  }
  if (/交通|怎么去|地址|公交|地铁|自驾|坐车|乘车/.test(question)) {
    if (isPending(`${service.address}${service.transport}`)) {
      return { missing: '资料库暂未收录完整的地址与公共交通信息，请通过实时地图和景区公开渠道规划出行。' };
    }
    return { answer: `地址：${service.address}。交通参考：${service.transport}。出发时请结合实时地图规划路线。`, sourceIds: [SOURCE_IDS.PROJECT_SERVICE_CONFIG] };
  }
  if (/电话|联系|咨询/.test(question)) {
    if (isPending(service.phone)) {
      return { missing: '资料库暂未收录联系电话，请以景区公开渠道为准。' };
    }
    return { answer: `当前项目记录的景区联系电话为${service.phone}。票务、停车、临时开放和特殊通行安排建议直接致电确认。`, sourceIds: [SOURCE_IDS.PROJECT_SERVICE_CONFIG] };
  }
  if (/建议.*时间|游览.*多久|逛.*多久|需要多久|多长时间/.test(question)) {
    if (!routes.length) return { missing: '未找到可靠资料：景区游览用时尚未整理。' };
    return {
      answer: `当前${routes.length}条路线的用时均为参考值：${routes.map((route) => `${route.name}${routeDuration(route.duration)}`).join('；')}。实际用时会受停留、讲解和现场开放情况影响。`,
      sourceIds: [SOURCE_IDS.PROJECT_ROUTE_PLAN],
    };
  }
  if (/路线|怎么游|游览/.test(question)) {
    if (!routes.length) return { missing: '未找到可靠资料：景区参考路线尚未整理。' };
    return {
      answer: `目前有${routes.length}条参考路线：${routes.map((route) => route.name).join('、')}。请在“推荐路线”页面查看各站点，并结合现场开放情况灵活调整。`,
      sourceIds: [SOURCE_IDS.PROJECT_ROUTE_PLAN],
    };
  }
  return null;
}

module.exports = {
  SOURCE_IDS,
  buildKnowledgeItems,
  fixedFact,
  normalize,
  retrieve,
};
