const { getTourRoutes, getErrorMessage } = require('../../services/api');
const { getDisplayClass } = require('../../utils/display-settings');

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
      const sharedRoute = result.data.find((item) => item.id === this.sharedRouteId);
      this.setData({ routes: result.data, meta: result.meta, expandedId: sharedRoute?.id || '', offlineNotice: result._cache?.notice || '', loading: false });
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
