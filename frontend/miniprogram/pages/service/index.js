const { getService, getErrorMessage } = require('../../services/api');
const { getDisplayClass } = require('../../utils/display-settings');

const TICKET_STATES = [
  { key: 'pending', index: '01', name: '准备中', meta: '入口未配置' },
  { key: 'open', index: '02', name: '已开放', meta: '可跳转官方' },
  { key: 'failed', index: '03', name: '跳转失败', meta: '复制链接访问' },
];

const NEARBY = [
  { name: '泥楼', image: '/images/arc/arc-colonnade.jpg' },
  { name: '后花园', image: '/images/arc/arc-garden-moon.jpg' },
  { name: '镬耳大屋', image: '/images/arc/arc-gable.jpg' },
];

function resolveTicketState(ticket) {
  if (!ticket || ticket.enabled !== true) return 'pending';
  return ticket.appId ? 'open' : 'failed';
}

function ticketStateLine(state) {
  if (state === 'open') return '官方购票渠道已接入';
  if (state === 'failed') return '跳转未完成，可复制官方链接';
  return '订票入口尚未开放';
}

function ticketPrimaryLabel(ticket) {
  if (!ticket || ticket.enabled !== true) return '订票入口准备中';
  return ticket.appId ? '微信内打开官方购票' : '打开官方购票';
}

Page({
  data: {
    service: null,
    loading: true,
    error: '',
    displayClass: '',
    ticketState: 'pending',
    ticketStateLine: '订票入口尚未开放',
    ticketPrimaryLabel: '订票入口准备中',
    ticketStates: TICKET_STATES,
    ticketSheet: false,
    linkCopied: false,
    nearby: NEARBY,
  },
  onShow() {
    this.setData({ displayClass: getDisplayClass() });
    if (!this.loaded) this.loadService();
  },
  async loadService() {
    this.setData({ loading: true, error: '' });
    try {
      const result = await getService();
      const service = result.data;
      const ticket = service.ticket || {};
      const ticketState = resolveTicketState(ticket);
      this.loaded = true;
      this.setData({
        service,
        loading: false,
        ticketState,
        ticketStateLine: ticketStateLine(ticketState),
        ticketPrimaryLabel: ticketPrimaryLabel(ticket),
      });
    } catch (error) {
      this.setData({ loading: false, error: getErrorMessage(error, '服务信息加载失败，请稍后重试。') });
    }
  },
  handleTicket() {
    const ticket = (this.data.service && this.data.service.ticket) || {};
    if (ticket.enabled !== true) {
      wx.showModal({
        title: '订票入口准备中',
        content: '官方购票平台尚未配置。本小程序不代售、不收款，请以景区最新公告为准。',
        showCancel: false,
      });
      return;
    }
    if (!ticket.appId) {
      this.showTicketFallback();
      return;
    }
    wx.navigateToMiniProgram({
      appId: ticket.appId,
      path: ticket.path || '',
      success: () => {
        this.setData({ ticketState: 'open', ticketStateLine: ticketStateLine('open') });
      },
      fail: () => this.showTicketFallback(),
    });
  },
  copyTicketLink() {
    const ticket = (this.data.service && this.data.service.ticket) || {};
    if (!ticket.url) {
      this.showTicketFallback();
      return;
    }
    wx.setClipboardData({
      data: ticket.url,
      success: () => wx.showToast({ title: '官方链接已复制', icon: 'none' }),
    });
  },
  showTicketFallback() {
    this.setData({ ticketState: 'failed', ticketStateLine: ticketStateLine('failed'), ticketSheet: true, linkCopied: false });
  },
  closeTicketSheet() {
    this.setData({ ticketSheet: false });
  },
  copyTicketLinkFromSheet() {
    const ticket = (this.data.service && this.data.service.ticket) || {};
    if (!ticket.url) {
      this.showPending('官方购票链接尚未配置');
      return;
    }
    wx.setClipboardData({
      data: ticket.url,
      success: () => this.setData({ linkCopied: true }),
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
  noop() {},
});
