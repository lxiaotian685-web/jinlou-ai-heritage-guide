const { getRecommendations, trackRecommendation } = require('../../services/api');

Page({
  data: { title: '周边推荐', items: [], loading: true, error: '', activeItem: null },
  onLoad(options) {
    this.category = options.category;
    const title = options.title ? decodeURIComponent(options.title) : '周边推荐';
    wx.setNavigationBarTitle({ title });
    this.setData({ title });
    this.loadRecommendations();
  },
  async loadRecommendations() {
    this.setData({ loading: true, error: '' });
    try {
      const result = await getRecommendations(this.category);
      this.setData({ items: (result.data || []).filter((item) => item.status === 'online').sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)), loading: false });
    } catch (_error) {
      this.setData({ loading: false, error: '推荐内容加载失败，请稍后重试。' });
    }
  },
  showDetail(event) {
    const activeItem = this.data.items.find((item) => item.id === event.currentTarget.dataset.id);
    this.setData({ activeItem });
    if (activeItem) this.trackAction(activeItem.id, 'detail');
  },
  trackAction(itemId, action) {
    trackRecommendation(itemId, action).catch(() => {});
  },
  closeDetail() {
    this.setData({ activeItem: null });
  },
  stopPropagation() {},
  showMapPending() {
    wx.showToast({ title: '地图位置待接入', icon: 'none' });
  },
  callMerchant() {
    const phone = this.data.activeItem?.phone;
    if (!phone) return wx.showToast({ title: '商家电话待接入', icon: 'none' });
    wx.makePhoneCall({ phoneNumber: phone, success: () => this.trackAction(this.data.activeItem.id, 'phone') });
  },
  copyMerchantLink() {
    const link = this.data.activeItem?.linkUrl;
    if (!link) return wx.showToast({ title: '商家链接待接入', icon: 'none' });
    wx.setClipboardData({ data: link, success: () => this.trackAction(this.data.activeItem.id, 'link') });
  },
});
