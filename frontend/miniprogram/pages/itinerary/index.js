const { getSpots, getTourRoutes, askAssistant, getErrorMessage } = require('../../services/api');
const { buildAssistantQuestion, buildItinerary, toSelectedRoute } = require('../../utils/itinerary-planner');
const { getDisplayClass } = require('../../utils/display-settings');

const DURATIONS = [
  { value: 45, label: '45分钟', note: '抓住核心' },
  { value: 90, label: '90分钟', note: '从容参观' },
  { value: 120, label: '120分钟', note: '深入漫游' },
];
const COMPANIONS = [
  { value: 'solo', label: '独自' },
  { value: 'family', label: '亲子' },
  { value: 'senior', label: '长者同行' },
  { value: 'study', label: '同学研学' },
];
const INTERESTS = [
  { value: 'craft', label: '金漆木雕', selected: false },
  { value: 'architecture', label: '岭南建筑', selected: true },
  { value: 'garden', label: '园林', selected: false },
  { value: 'history', label: '历史故事', selected: false },
  { value: 'photo', label: '拍照', selected: false },
];

Page({
  data: {
    displayClass: '', durations: DURATIONS, companions: COMPANIONS, interests: INTERESTS,
    duration: 90, companion: 'solo', selectedInterests: ['architecture'],
    loading: false, error: '', result: null, aiLoading: false, aiAdvice: '', aiNotice: '',
  },
  onShow() {
    this.setData({ displayClass: getDisplayClass() });
  },
  selectDuration(event) {
    this.setData({ duration: Number(event.currentTarget.dataset.value), result: null, aiAdvice: '', aiNotice: '' });
  },
  selectCompanion(event) {
    this.setData({ companion: event.currentTarget.dataset.value, result: null, aiAdvice: '', aiNotice: '' });
  },
  toggleInterest(event) {
    const value = event.currentTarget.dataset.value;
    const current = this.data.selectedInterests;
    if (current.includes(value)) {
      if (current.length === 1) return wx.showToast({ title: '请至少保留一个兴趣', icon: 'none' });
      const selectedInterests = current.filter((item) => item !== value);
      this.setData({ selectedInterests, interests: this.data.interests.map((item) => ({ ...item, selected: selectedInterests.includes(item.value) })), result: null, aiAdvice: '', aiNotice: '' });
      return;
    }
    if (current.length >= 3) return wx.showToast({ title: '最多选择三个兴趣', icon: 'none' });
    const selectedInterests = [...current, value];
    this.setData({ selectedInterests, interests: this.data.interests.map((item) => ({ ...item, selected: selectedInterests.includes(item.value) })), result: null, aiAdvice: '', aiNotice: '' });
  },
  async generatePlan() {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '', result: null, aiAdvice: '', aiNotice: '' });
    try {
      const [spotResult, routeResult] = await Promise.all([getSpots(), getTourRoutes()]);
      const result = buildItinerary({
        spots: spotResult.data,
        routes: routeResult.data,
        duration: this.data.duration,
        companion: this.data.companion,
        interests: this.data.selectedInterests,
      });
      const offlineNotice = spotResult._cache?.notice || routeResult._cache?.notice || '';
      this.setData({ result, loading: false, aiNotice: offlineNotice });
      this.loadAiAdvice(result);
    } catch (error) {
      this.setData({ loading: false, error: getErrorMessage(error, '暂时无法生成游览建议，请稍后重试。') });
    }
  },
  async loadAiAdvice(result) {
    this.setData({ aiLoading: true });
    try {
      const response = await askAssistant(buildAssistantQuestion(result));
      const advice = String(response.data?.answer || '').trim();
      if (!advice) throw new Error('AI未返回补充建议');
      this.setData({
        aiLoading: false,
        aiAdvice: advice,
        aiNotice: response.data?.mode === 'model' ? 'AI已根据现有资料补充提醒' : '当前使用知识库规则补充提醒',
        'result.mode': response.data?.mode === 'model' ? 'ai-enhanced' : 'rule-fallback',
        'result.modeLabel': response.data?.mode === 'model' ? 'AI辅助推荐' : '受控规则推荐',
      });
    } catch (_error) {
      this.setData({ aiLoading: false, aiAdvice: '', aiNotice: 'AI补充暂不可用，以下路线仍可正常使用。' });
    }
  },
  openSpot(event) {
    const id = event.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: `/pages/spot-detail/index?id=${encodeURIComponent(id)}` });
  },
  useOnGuide() {
    if (!this.data.result) return;
    wx.setStorageSync('selectedTourRoute', toSelectedRoute(this.data.result));
    wx.switchTab({ url: '/pages/guide/index' });
  },
  resetPlan() {
    this.setData({ result: null, error: '', aiAdvice: '', aiNotice: '' });
  },
  backToRoutes() {
    wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/routes/index' }) });
  },
});
