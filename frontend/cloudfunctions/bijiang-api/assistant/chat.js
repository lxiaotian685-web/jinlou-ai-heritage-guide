const { buildKnowledgeItems, fixedFact, retrieve } = require('./knowledge');

const { createWebSearch } = require('./web-search');

const SENSITIVE_PATTERN = /密钥|api[\s_-]?key|系统提示|提示词|prompt|忽略.*(规则|指令)|开发者模式|后台口令|token|数据库密码/i;

const STATUS_LABELS = {
  fixed_fact: '来自已整理资料',
  web_rag: '已结合联网资料生成回答',
  web_fallback: '联网资料摘要',
  knowledge_rag: '已根据资料库生成回答',
  rule_fallback: '已根据资料库直接回答',
  not_ready: '资料库暂未收录',
};

function visitorSafeText(value) {
  return String(value || '')
    .replace(/(?:仍|尚|还)?待(?:景区|专家|现场|人工)[^，。；\n]*(?:审核|复核|确认|实走|标定)[^，。；\n]*/g, '相关细节请以现场展签和开放情况为准')
    .replace(/review-draft|pending-(?:scenic|expert|field)-review/gi, '')
    .replace(/\s+([，。；])/g, '$1')
    .trim();
}

function reply({ mode, answer, sourceIds = [], reviewStatus, publicStatus, requestId = '', fallbackReason = '', model = '', matches = [] }) {
  return {
    answer: visitorSafeText(answer),
    mode,
    sourceIds,
    webSources: matches.filter((match) => match.item.category === 'web').map((match) => ({
      id: match.item.id, title: match.item.title, url: match.item.sourceUrl,
      organization: '联网检索', verificationStatus: 'web-reference',
      scope: '网络公开资料，非景区官方确认',
    })),
    reviewStatus,
    publicStatus,
    fallbackReason,
    requestId,
    model,
    notice: visitorSafeText(STATUS_LABELS[mode] || ''),
    matches: matches.map((match) => ({
      id: match.item.id,
      title: match.item.title,
      score: match.score,
      reason: match.reason,
    })),
  };
}

function ruleAnswer(matches) {
  const top = matches.slice(0, 2).map((match) => match.item.content).filter(Boolean);
  return `根据已登记资料：${top.join('\n')}`;
}

async function answerQuestion({ question, input, provider, requestId = '', clientKey = 'anonymous', rateLimiter = null, webSearch = createWebSearch() }) {
  const text = String(question || '').trim();

  if (SENSITIVE_PATTERN.test(text)) {
    return reply({
      mode: 'not_ready',
      answer: '该问题不在景区资料问答范围内。我只回答已登记的景点、路线、服务与工艺资料，不会提供系统配置、接口地址或密钥信息。',
      reviewStatus: 'information-pending',
      publicStatus: 'not-ready',
      requestId,
    });
  }

  const fixed = fixedFact(input, text);
  if (fixed?.answer) {
    return reply({
      mode: 'fixed_fact',
      answer: fixed.answer,
      sourceIds: fixed.sourceIds,
      reviewStatus: 'pending-scenic-review',
      publicStatus: 'review-draft',
      requestId,
    });
  }

  const items = buildKnowledgeItems(input);
  let matches = fixed?.missing ? [] : retrieve(items, text);
  let charged = false;
  let searchFailure = '';
  if (!matches.length && webSearch.enabled && /金楼|碧江|岭南|木雕|这个楼|这座楼|这栋楼|景区/.test(text)) {
    if (rateLimiter && !rateLimiter.check(clientKey).allowed) {
      searchFailure = 'rate_limited';
    } else {
      charged = true;
      try { matches = await webSearch.search(text); }
      catch (_) { searchFailure = 'search_unavailable'; }
    }
  }
  const isWeb = matches.some((match) => match.item.category === 'web');
  if (!matches.length) {
    return reply({
      mode: 'not_ready',
      answer: searchFailure ? '暂时无法完成检索，请稍后重试。' : (fixed?.missing || '未找到可靠资料：资料库暂未找到对应内容。你可以补充景点名称或换一种问法；联网检索未启用或未找到可用资料时，我不会编造答案。'),
      fallbackReason: searchFailure,
      reviewStatus: 'information-pending',
      publicStatus: 'not-ready',
      requestId,
    });
  }

  const sourceIds = [...new Set(matches.slice(0, 2).flatMap((match) => match.item.sourceIds || [match.item.sourceId]).filter(Boolean))];
  const topItem = matches[0]?.item || {};
  const reviewStatus = topItem.reviewStatus
    || (matches.some((match) => match.item.reviewStatus === 'pending-expert-review') ? 'pending-expert-review' : 'pending-scenic-review');
  const publicStatus = topItem.publicStatus || 'review-draft';

  if (!charged && rateLimiter && !rateLimiter.check(clientKey).allowed) {
    return reply({
      mode: 'rule_fallback',
      answer: ruleAnswer(matches),
      sourceIds,
      reviewStatus,
      publicStatus,
      requestId,
      fallbackReason: 'rate_limited',
      model: provider.name,
      matches,
    });
  }

  try {
    const result = await provider.answer({
      question: text,
      matches: matches.map((match) => ({
        title: match.item.title,
        content: match.item.content,
        category: match.item.category,
        reason: match.reason,
      })),
    });
    // A keyword hit is not proof that the documents answer the question.
    // Retry once with web evidence, within the same request quota.
    const insufficient = result.insufficientEvidence === true
      || /(?:资料库|资料)(?:暂未收录|不足|未包含)|无法据此推荐/.test(result.answer);
    if (!isWeb && insufficient && webSearch.enabled && /金楼|碧江|岭南|木雕|这个楼|这座楼|这栋楼|景区/.test(text)) {
      let webMatches;
      try { webMatches = await webSearch.search(text); }
      catch (_) {
        return reply({ mode: 'not_ready', answer: '现有资料不足，联网检索暂时失败，请稍后重试。', fallbackReason: 'search_unavailable', requestId });
      }
      if (!webMatches.length) {
        return reply({ mode: 'not_ready', answer: '现有资料不足，联网也未找到可用资料。请补充具体地点或换一种问法。', fallbackReason: 'search_empty', requestId });
      }
      try {
        const webResult = await provider.answer({ question: text, matches: webMatches.map(({item}) => ({ title: item.title, content: item.content, category: item.category })) });
        return reply({ mode: 'web_rag', answer: webResult.answer, requestId, model: webResult.model || provider.name, matches: webMatches });
      } catch (_) {
        return reply({ mode: 'web_fallback', answer: '已找到联网资料，但回答整理暂时失败，请稍后重试或查看下方来源。', fallbackReason: 'provider_error', requestId, matches: webMatches });
      }
    }
    return reply({
      mode: isWeb ? 'web_rag' : 'knowledge_rag',
      answer: result.answer,
      sourceIds,
      reviewStatus,
      publicStatus,
      requestId,
      model: result.model || provider.name,
      matches,
    });
  } catch (error) {
    const fallbackReason = error?.name === 'AbortError' || /timeout/i.test(String(error?.message))
      ? 'timeout'
      : (error?.code || 'provider_error');
    return reply({
      mode: isWeb ? 'web_fallback' : 'rule_fallback',
      answer: isWeb ? '模型暂时不可用，以下是联网检索的资料摘要：\n' + matches.map((m) => m.item.content).join('\n') : ruleAnswer(matches),
      sourceIds,
      reviewStatus,
      publicStatus,
      requestId,
      fallbackReason,
      model: provider.name,
      matches,
    });
  }
}

module.exports = {
  STATUS_LABELS,
  answerQuestion,
};
