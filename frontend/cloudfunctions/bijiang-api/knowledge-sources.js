const SOURCE_IDS = Object.freeze({
  SHUNDE_MUSEUM_JINLOU: 'shunde-museum-jinlou',
  SYSU_FIELD_STUDY: 'sysu-bijiang-field-study',
  PROJECT_SPOT_RECORDS: 'project-spot-records',
  PROJECT_CRAFT_GUIDE: 'project-craft-guide',
  PROJECT_SERVICE_CONFIG: 'project-service-config',
  PROJECT_ROUTE_PLAN: 'project-route-plan',
});

const sourceCatalog = Object.freeze({
  [SOURCE_IDS.SHUNDE_MUSEUM_JINLOU]: {
    id: SOURCE_IDS.SHUNDE_MUSEUM_JINLOU,
    title: '顺德区博物馆：碧江金楼',
    organization: '佛山市顺德区博物馆',
    url: 'https://www.sdmuseum.com.cn/unmoveabledetail.html?id=1551',
    verificationStatus: 'verified-public-reference',
    lastReviewed: '2026-10-18',
    scope: '金楼原名、建造人物与年代、木雕构件、雕刻和饰金工艺',
  },
  [SOURCE_IDS.SYSU_FIELD_STUDY]: {
    id: SOURCE_IDS.SYSU_FIELD_STUDY,
    title: '中山大学历史学系：碧江金楼古建筑群田野考察',
    organization: '中山大学历史学系',
    url: 'https://history.sysu.edu.cn/article/1296',
    verificationStatus: 'verified-public-reference',
    lastReviewed: '2026-10-18',
    scope: '碧江苏氏聚居背景与古建筑群组成',
  },
  [SOURCE_IDS.PROJECT_SPOT_RECORDS]: {
    id: SOURCE_IDS.PROJECT_SPOT_RECORDS,
    title: '金漆木雕手记景点资料',
    organization: '金漆木雕手记项目组',
    url: '',
    verificationStatus: 'pending-scenic-review',
    lastReviewed: '2026-10-18',
    scope: '15个景点的文化学习简介',
  },
  [SOURCE_IDS.PROJECT_CRAFT_GUIDE]: {
    id: SOURCE_IDS.PROJECT_CRAFT_GUIDE,
    title: '金漆木雕手记工艺导览',
    organization: '金漆木雕手记项目组',
    url: '',
    verificationStatus: 'pending-expert-review',
    lastReviewed: '2026-10-18',
    scope: '构件、雕刻层次与饰金观察提示',
  },
  [SOURCE_IDS.PROJECT_SERVICE_CONFIG]: {
    id: SOURCE_IDS.PROJECT_SERVICE_CONFIG,
    title: '碧江金楼游览服务资料',
    organization: '金漆木雕手记项目组',
    url: '',
    verificationStatus: 'pending-scenic-review',
    lastReviewed: '2026-10-18',
    scope: '地址、开放时间、联系电话与交通信息',
  },
  [SOURCE_IDS.PROJECT_ROUTE_PLAN]: {
    id: SOURCE_IDS.PROJECT_ROUTE_PLAN,
    title: '金漆木雕手记推荐路线',
    organization: '金漆木雕手记项目组',
    url: '',
    verificationStatus: 'pending-field-check',
    lastReviewed: '2026-10-18',
    scope: '推荐路线、参观点与参考用时',
  },
});

const aliases = {
  '当前景点资料库': SOURCE_IDS.PROJECT_SPOT_RECORDS,
  '当前工艺导览资料': SOURCE_IDS.PROJECT_CRAFT_GUIDE,
  '当前服务信息资料库': SOURCE_IDS.PROJECT_SERVICE_CONFIG,
  '当前推荐路线资料库': SOURCE_IDS.PROJECT_ROUTE_PLAN,
};

function resolveKnowledgeSources(references = []) {
  const seen = new Set();
  return references.map((source) => {
    if (source && typeof source === 'object') return source;
    const reference = String(source || '').trim();
    const id = aliases[reference] || reference;
    return sourceCatalog[id] || {
      id: `unmapped:${reference}`,
      title: reference,
      organization: '',
      url: '',
      verificationStatus: 'pending-review',
      lastReviewed: '',
      scope: '来源信息待补充',
    };
  }).filter((source) => {
    const key = source.id || `${source.title}|${source.url}`;
    if (!source.title || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const assistantSuggestions = Object.freeze([
  { id: 'name-origin', category: '历史文化', question: '金楼为什么叫金楼？' },
  { id: 'building-age', category: '历史文化', question: '金楼是什么年代建造的？' },
  { id: 'important-person', category: '历史文化', question: '苏丕文与金楼有什么关系？' },
  { id: 'woodcraft', category: '木雕研学', question: '这里的木雕看什么？' },
  { id: 'highlights', category: '参观建议', question: '有哪些重点看点？' },
  { id: 'visit-duration', category: '参观建议', question: '建议游览多久？' },
  { id: 'accessibility', category: '参观须知', question: '老人儿童和轮椅通行要注意什么？' },
]);

module.exports = { SOURCE_IDS, assistantSuggestions, resolveKnowledgeSources };
