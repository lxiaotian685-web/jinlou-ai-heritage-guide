const { getService, getErrorMessage } = require('../../services/api');
const { getDisplayClass } = require('../../utils/display-settings');

Page({
  data: { service: null, loading: true, error: '' },
  onShow() {
    this.setData({ displayClass: getDisplayClass() });
    if (!this.loaded) this.loadService();
  },
  async loadService() {
    this.setData({ loading: true, error: '' });
    try {
      const result = await getService();
      this.loaded = true;
      this.setData({ service: result.data, loading: false });
    } catch (error) {
      this.setData({ loading: false, error: getErrorMessage(error, '服务信息加载失败，请稍后重试。') });
    }
  },
  handleTicket() {
    if (!this.data.service.ticket.enabled) {
      wx.showModal({ title: '订票入口准备中', content: '正式订票平台尚未配置，请以景区最新公告为准。', showCancel: false });
      return;
    }
    wx.setClipboardData({
      data: this.data.service.ticket.url,
      success: () => wx.showModal({
        title: '官方订票链接已复制',
        content: '请在浏览器中打开。票价、开放时间和退改规则以官方平台为准。',
        showCancel: false,
      }),
    });
  },
  copyAddress() {
    if (!this.data.service.actions.copyAddress) return this.showPending('正式地址尚未配置');
    wx.setClipboardData({ data: this.data.service.address });
  },
  callPhone() {
    if (!this.data.service.actions.callPhone) return this.showPending('正式联系电话尚未配置');
    wx.makePhoneCall({ phoneNumber: this.data.service.phone });
  },
  openMap() {
    if (!this.data.service.actions.openMap) return this.showPending('地图坐标尚未配置');
    wx.openLocation({
      latitude: this.data.service.latitude,
      longitude: this.data.service.longitude,
      name: '碧江金楼',
      address: this.data.service.address,
    });
  },
  showPending(message) {
    wx.showToast({ title: message, icon: 'none' });
  },
  openRecommendations(event) {
    const { category, title } = event.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/recommendations/index?category=${category}&title=${encodeURIComponent(title)}` });
  },
});
