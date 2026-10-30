const { getTourRoutes, getErrorMessage } = require('../../services/api');
const { getDisplayClass } = require('../../utils/display-settings');

function normalizeRoute(route = {}) {
  const duration = String(route.duration || '')
    .replace('参考游记约1—1.5小时，待实测', '建议用时约1—1.5小时')
    .replace('用时待现场实走确认', '建议按兴趣与停留时间安排');
  return {
    ...route,
    verificationLabel: '推荐游线',
    duration,
    theme: String(route.theme || '').replace('参考公开游客实走记录，顺序待景区确认', '串联碧江金楼主要参观点'),
    passageNotice: '请根据现场开放情况与工作人员指引灵活调整游览顺序。',
  };
}

function normalizeMeta(meta = {}) {
  return {
    ...meta,
    statusLabel: '游览路线',
    notice: '1—15为景点编号，可按兴趣选择经典、古建或园林主题路线。',
    safetyNotice: '游览时请留意现场公告，并根据开放情况与工作人员指引调整路线。',
  };
}

Page({
  data: { routes: [], meta: null, loading: true, error: '', offlineNotice: '', expandedId: '' },
  onLoad(options) {
    this.sharedRouteId = options.routeId || (options.scene ? decodeURIComponent(options.scene) : '');
    this.loadRoutes();
  },
  onShow() { this.setData({ displayClass: getDisplayClass() }); },
  onShareAppMessage(event) {
    const id = event.target?.dataset?.id || this.data.expandedId;
    const route = this.data.routes.find((item) => item.id === id);
    return route
      ? { title: `碧江金楼 · ${route.name}`, path: `/pages/routes/index?routeId=${encodeURIComponent(route.id)}` }
      : { title: '碧江金楼推荐路线', path: '/pages/routes/index' };
  },
  async loadRoutes() {
    this.setData({ loading: true, error: '', offlineNotice: '' });
    try {
      const result = await getTourRoutes();
      const routes = result.data.map(normalizeRoute);
      const sharedRoute = routes.find((item) => item.id === this.sharedRouteId);
      this.setData({ routes, meta: normalizeMeta(result.meta), expandedId: sharedRoute?.id || '', offlineNotice: result._cache?.notice || '', loading: false });
      if (this.sharedRouteId && !sharedRoute) wx.showToast({ title: '分享的路线不存在，已显示全部路线', icon: 'none' });
    } catch (error) {
      this.setData({ loading: false, error: getErrorMessage(error, '推荐游线加载失败，请稍后重试。') });
    }
  },
  toggleRoute(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({ expandedId: this.data.expandedId === id ? '' : id });
  },
  backHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },
  openOnGuide(event) {
    const route = this.data.routes.find((item) => item.id === event.currentTarget.dataset.id);
    if (!route) return;
    wx.setStorageSync('selectedTourRoute', route);
    wx.switchTab({ url: '/pages/guide/index' });
  },
});
