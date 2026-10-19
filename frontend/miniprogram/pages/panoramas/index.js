const { getPanoramas } = require('../../services/api');
const { getDisplayClass } = require('../../utils/display-settings');

Page({
  data: { panoramas: [], loading: true, error: '', displayClass: '' },
  onShow() {
    this.setData({ displayClass: getDisplayClass() });
    if (!this.loaded) this.loadPanoramas();
  },
  async loadPanoramas() {
    this.setData({ loading: true, error: '' });
    try {
      const result = await getPanoramas();
      this.loaded = true;
      this.setData({ panoramas: result.data, loading: false });
    } catch (_error) {
      this.setData({ loading: false, error: '暂时无法读取全景列表，请确认后端服务已启动。' });
    }
  },
  openPanorama(event) {
    wx.navigateTo({ url: `/pages/panorama-viewer/index?id=${event.currentTarget.dataset.id}` });
  },
});
