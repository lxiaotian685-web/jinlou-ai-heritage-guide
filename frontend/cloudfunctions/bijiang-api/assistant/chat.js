const { buildKnowledgeItems, fixedFact, retrieve } = require('./knowledge');

const SENSITIVE_PATTERN = /密钥|api[\s_-]?key|系统提示|提示词|prompt|忽略.*(规则|指令)|开发者模式|后台口令|token|数据库密码/i;

const STATUS_LABELS = {
  fixed_fact: '固定信息 · 待景区复核',
  knowledge_rag: '公开资料核对稿 · 待景区审核',
  rule_fallback: '公开资料核对稿 · 待景区审核（模型不可用，已用规则回答）',
  not_ready: '资料不足 · 待人工核对',
};

function reply({ mode, answer, sourceIds = [], reviewStatus, publicStatus, requestId = '', fallbackReason = '', model = '', matches = [] }) {
  return {
    answer,
    mode,
    sourceIds,
    reviewStatus,
    publicStatus,
    fallbackReason,
    requestId,
    model,
    notice: STATUS_LABELS[mode] || '',
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

async function answerQuestion({ question, input, provider, requestId = '', clientKey = 'anonymous', rateLimiter = null }) {
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
  if (fixed?.missing) {
    return reply({
      mode: 'not_ready',
      answer: fixed.missing,
      reviewStatus: 'information-pending',
      publicStatus: 'not-ready',
      requestId,
    });
  }
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
  const matches = retrieve(items, text);
  if (!matches.length) {
    return reply({
      mode: 'not_ready',
      answer: '未找到可靠资料：资料库暂未收录与该问题对应的内容。可以改问景点介绍、游览路线、开放或票务信息、木雕工艺；票务与通行政策以景区最新公告为准。',
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

  if (rateLimiter && !rateLimiter.check(clientKey).allowed) {
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
    return reply({
      mode: 'knowledge_rag',
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
      mode: 'rule_fallback',
      answer: ruleAnswer(matches),
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
