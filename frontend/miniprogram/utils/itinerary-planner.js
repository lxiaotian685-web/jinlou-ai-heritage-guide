const DURATION_LIMITS = Object.freeze({ 45: 3, 90: 5, 120: 7 });

const INTERESTS = Object.freeze({
  craft: { label: '金漆木雕', keywords: ['金楼', '构件'], categories: ['建筑展陈'], routeWeights: { 'architecture-focus': 5, 'visitor-classic': 3 } },
  architecture: { label: '岭南建筑', keywords: ['南山祠', '职方第', '对朝', '金楼', '泥楼', '镬耳', '亦渔遗塾'], categories: ['祠堂建筑', '宅第建筑', '古建筑', '古建景点', '传统民居', '建筑形制', '教育建筑'], routeWeights: { 'architecture-focus': 6, 'visitor-classic': 2 } },
  garden: { label: '园林', keywords: ['后花园', '抱月亭', '二十四咏', '叠趣亭'], categories: ['园林亭阁', '园林景观', '文化景观'], routeWeights: { 'garden-slow': 7 } },
  history: { label: '历史故事', keywords: ['南山祠', '职方第', '金楼', '守清屋', '伯韶医馆', '亦渔遗塾'], categories: ['历史展陈', '医馆展陈', '教育建筑'], routeWeights: { 'visitor-classic': 5, 'architecture-focus': 3 } },
  photo: { label: '拍照', keywords: ['金楼', '镬耳', '抱月亭', '叠趣亭', '后花园'], categories: ['古建景点', '建筑形制', '传统民居', '园林亭阁', '园林景观'], routeWeights: { 'garden-slow': 5, 'architecture-focus': 3 } },
});

const COMPANIONS = Object.freeze({
  solo: { label: '独自游览', routeWeights: { 'visitor-classic': 3, 'architecture-focus': 2 } },
  family: { label: '亲子同行', routeWeights: { 'garden-slow': 5, 'visitor-classic': 2 } },
  senior: { label: '长者同行', routeWeights: { 'garden-slow': 5, 'visitor-classic': 3 }, maxStops: 5 },
  study: { label: '同学研学', routeWeights: { 'architecture-focus': 5, 'visitor-classic': 2 } },
});

function canonicalName(value) {
  return String(value || '').replace(/[（(].*?[）)]/g, '').replace(/\s+/g, '').trim();
}

function normalizeDuration(value) {
  const duration = Number(value);
  return Object.hasOwn(DURATION_LIMITS, duration) ? duration : 90;
}

function normalizeInterests(values) {
  const items = Array.isArray(values) ? values : [values];
  return [...new Set(items.filter((item) => Object.hasOwn(INTERESTS, item)))].slice(0, 3);
}

function spotMatchesInterest(spot, interest) {
  const config = INTERESTS[interest];
  if (!config) return false;
  const name = canonicalName(spot.name);
  return config.keywords.some((keyword) => name.includes(canonicalName(keyword))) || config.categories.includes(spot.category);
}

function buildSpotIndex(spots) {
  const byName = new Map();
  for (const spot of Array.isArray(spots) ? spots : []) {
    if (!spot || !spot.id || !spot.name) continue;
    byName.set(canonicalName(spot.name), spot);
  }
  return byName;
}

function resolveRouteStops(route, spots) {
  const byName = buildSpotIndex(spots);
  const pointByName = new Map((route.points || []).map((point) => [canonicalName(point.name), point]));
  return (route.stops || []).map((name, routeIndex) => {
    const spot = byName.get(canonicalName(name));
    if (!spot) return null;
    return { ...spot, routeIndex, point: pointByName.get(canonicalName(name)) || null };
  }).filter(Boolean);
}

function scoreRoute(route, companion, interests) {
  const companionConfig = COMPANIONS[companion] || COMPANIONS.solo;
  let score = companionConfig.routeWeights[route.id] || 0;
  for (const interest of interests) score += INTERESTS[interest]?.routeWeights?.[route.id] || 0;
  return score;
}

function selectRoute(routes, companion, interests) {
  const safeRoutes = (Array.isArray(routes) ? routes : []).filter((route) => route && route.id && Array.isArray(route.stops));
  return safeRoutes.map((route, index) => ({ route, index, score: scoreRoute(route, companion, interests) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.route || null;
}

function selectStops(routeStops, interests, limit) {
  const ranked = routeStops.map((spot) => ({
    spot,
    score: interests.reduce((total, interest) => total + (spotMatchesInterest(spot, interest) ? 3 : 0), 0)
      + (canonicalName(spot.name).includes('金楼') ? 2 : 0),
  }));
  const chosenIndexes = ranked.sort((left, right) => right.score - left.score || left.spot.routeIndex - right.spot.routeIndex)
    .slice(0, limit)
    .map((item) => item.spot.routeIndex)
    .sort((left, right) => left - right);
  const chosen = new Set(chosenIndexes);
  return routeStops.filter((spot) => chosen.has(spot.routeIndex));
}

function buildReason(spot, interests) {
  const matched = interests.filter((interest) => spotMatchesInterest(spot, interest)).map((interest) => INTERESTS[interest].label);
  if (matched.length) return `符合你选择的${matched.join('、')}兴趣`;
  if (canonicalName(spot.name).includes('金楼')) return '核心建筑，适合作为本次游览重点';
  return '用于保持既有推荐路线的连续性';
}

function buildItinerary({ spots, routes, duration, companion, interests }) {
  const normalizedDuration = normalizeDuration(duration);
  const normalizedCompanion = Object.hasOwn(COMPANIONS, companion) ? companion : 'solo';
  const normalizedInterests = normalizeInterests(interests);
  const effectiveInterests = normalizedInterests.length ? normalizedInterests : ['architecture'];
  const route = selectRoute(routes, normalizedCompanion, effectiveInterests);
  if (!route) throw new Error('暂无可用的已审核路线');
  const routeStops = resolveRouteStops(route, spots);
  if (!routeStops.length) throw new Error('路线与景点资料暂时无法匹配');
  const companionLimit = COMPANIONS[normalizedCompanion].maxStops || Number.POSITIVE_INFINITY;
  const limit = Math.min(DURATION_LIMITS[normalizedDuration], companionLimit, routeStops.length);
  const selectedStops = selectStops(routeStops, effectiveInterests, limit);
  const walkingBuffer = normalizedDuration === 45 ? 12 : (normalizedDuration === 90 ? 20 : 28);
  const perStop = Math.max(8, Math.floor((normalizedDuration - walkingBuffer) / selectedStops.length));
  const stops = selectedStops.map((spot, index) => ({
    id: spot.id,
    name: spot.name,
    category: spot.category,
    coverImage: spot.coverImage || '',
    order: index + 1,
    suggestedMinutes: perStop,
    reason: buildReason(spot, effectiveInterests),
    point: spot.point,
  }));
  return {
    id: `personal-${normalizedDuration}-${normalizedCompanion}-${effectiveInterests.join('-')}`,
    name: `${normalizedDuration}分钟个性游览建议`,
    sourceRouteId: route.id,
    sourceRouteName: route.name,
    duration: normalizedDuration,
    durationLabel: `约${normalizedDuration}分钟`,
    companion: normalizedCompanion,
    companionLabel: COMPANIONS[normalizedCompanion].label,
    interests: effectiveInterests,
    interestLabels: effectiveInterests.map((interest) => INTERESTS[interest].label),
    interestLabelText: effectiveInterests.map((interest) => INTERESTS[interest].label).join(' / '),
    stops,
    stopIds: stops.map((spot) => spot.id),
    notice: '路线仅作游览建议，请以现场开放情况、公告和工作人员指引为准。',
    mode: 'rule-fallback',
    modeLabel: '受控规则推荐',
  };
}

function toSelectedRoute(itinerary) {
  return {
    id: itinerary.id,
    name: itinerary.name,
    theme: `${itinerary.companionLabel} · ${itinerary.interestLabels.join('、')}`,
    duration: itinerary.durationLabel,
    audience: itinerary.companionLabel,
    stops: itinerary.stops.map((spot) => spot.name),
    stopIds: itinerary.stopIds,
    points: itinerary.stops.filter((spot) => spot.point).map((spot, index) => ({ ...spot.point, number: index + 1, spotId: spot.id })),
    personalized: true,
    sourceRouteId: itinerary.sourceRouteId,
  };
}

function buildAssistantQuestion(itinerary) {
  const question = `我有${itinerary.duration}分钟，${itinerary.companionLabel}，关注${itinerary.interestLabels.join('、')}。已按现有资料选择${itinerary.stops.map((spot) => spot.name).join('、')}。请只根据已整理资料，用80字以内补充参观重点和同行提醒；不要新增景点、路线、票价或开放时间。`;
  return question.slice(0, 200);
}

module.exports = {
  COMPANIONS,
  DURATION_LIMITS,
  INTERESTS,
  buildAssistantQuestion,
  buildItinerary,
  canonicalName,
  normalizeDuration,
  normalizeInterests,
  resolveRouteStops,
  toSelectedRoute,
};
