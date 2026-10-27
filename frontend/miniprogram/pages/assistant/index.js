const { askAssistant, getAssistantSuggestions, getErrorMessage } = require('../../services/api');
const { getDisplayClass } = require('../../utils/display-settings');

const FALLBACK_QUESTIONS = [
  '金楼为什么叫金楼？',
  '金楼是什么年代建造的？',
  '苏丕文与金楼有什么关系？',
  '这里的木雕看什么？',
  '有哪些重点看点？',
  '建议游览多久？',
].map((question, index) => ({ id: `fallback-${index}`, question }));

function verificationStatusLabel(status) {
  if (status === 'verified-public-reference') return '已核对公开资料';
  if (status === 'pending-scenic-review') return '待景区复核';
  if (status === 'pending-expert-review') return '待专家复核';
  if (status === 'pending-field-check') return '待现场实走';
  return '待补充核对';
}

function normalizeSources(sources = []) {
  return sources.map((source, index) => {
    const normalized = typeof source === 'string'
      ? { id: `legacy-${index}`, title: source, organization: '', url: '', verificationStatus: 'pending-review', scope: '' }
      : source;
    return normalized?.title ? { ...normalized, verificationLabel: verificationStatusLabel(normalized.verificationStatus) } : null;
  }).filter(Boolean);
}

function publicStatusLabel(status) {
  if (status === 'public') return '景区已审核';
  if (status === 'not-ready') return '暂不作为正式发布答案';
  return '公开资料核对稿，待景区审核';
}

const MODE_LABELS = {
  fixed_fact: '固定信息',
  knowledge_rag: '资料检索 + 模型整理',
  rule_fallback: '资料检索（规则回答）',
  not_ready: '资料库暂未收录',
};

Page({
  onLoad() { this.loadSuggestions(); },
  onShow() { this.setData({ displayClass: getDisplayClass() }); },
  data: {
    sending: false,
    loadingSuggestions: true,
    inputQuestion: '',
    questionLength: 0,
    selectedQuestion: '',
    answer: null,
    sourcesExpanded: false,
    quickQuestions: FALLBACK_QUESTIONS,
  },
  async loadSuggestions() {
    try {
      const result = await getAssistantSuggestions();
      const quickQuestions = (result.data || []).filter((item) => item?.question);
      this.setData({ quickQuestions: quickQuestions.length ? quickQuestions : FALLBACK_QUESTIONS, loadingSuggestions: false });
    } catch (_error) {
      this.setData({ quickQuestions: FALLBACK_QUESTIONS, loadingSuggestions: false });
    }
  },
  handleQuestionInput(event) {
    const inputQuestion = event.detail.value || '';
    this.setData({ inputQuestion, questionLength: inputQuestion.length });
  },
  chooseQuickQuestion(event) {
    const question = event.currentTarget.dataset.question;
    this.setData({ inputQuestion: question, questionLength: question.length });
    this.loadAnswer(question);
  },
  submitQuestion() {
    const question = this.data.inputQuestion.trim();
    if (!question) return wx.showToast({ title: '请先输入问题', icon: 'none' });
    return this.loadAnswer(question);
  },
  retryLastQuestion() {
    return this.loadAnswer(this.data.selectedQuestion);
  },
  toggleSources() {
    this.setData({ sourcesExpanded: !this.data.sourcesExpanded });
  },
  copySourceUrl(event) {
    const url = event.currentTarget.dataset.url;
    if (url) wx.setClipboardData({ data: url });
  },
  async loadAnswer(question) {
    if (!question || this.data.sending) return;
    this.setData({ selectedQuestion: question, inputQuestion: question, questionLength: question.length, answer: null, sourcesExpanded: false, sending: true });
    try {
      const result = await askAssistant(question);
      const data = result.data || {};
      this.setData({
        answer: {
          text: data.answer,
          notice: data.notice,
          modeLabel: MODE_LABELS[data.mode] || '',
          fallbackHint: data.mode === 'rule_fallback' ? '模型暂不可用或超时，已改用规则回答。' : '',
          requestId: data.requestId || '',
          sources: normalizeSources(data.sources),
          publicStatus: publicStatusLabel(data.publicStatus),
        },
        sending: false,
      });
    } catch (error) {
      this.setData({
        answer: { text: getErrorMessage(error, '资料加载失败，请检查网络后重试。'), sources: [], isError: true, canRetry: true },
        sending: false,
      });
    }
  },
});
