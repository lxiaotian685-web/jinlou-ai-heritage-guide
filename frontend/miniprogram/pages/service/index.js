const { getService, getErrorMessage } = require('../../services/api');
const { getDisplayClass } = require('../../utils/display-settings');
const config = require('../../config');

const TICKET_STATES = [
  { key: 'pending', index: '01', name: '准备中', meta: '入口未配置' },
  { key: 'open', index: '02', name: '已开放', meta: '可跳转官方' },
  { key: 'link', index: '03', name: '需复制链接', meta: '小程序 / 网页' },
];

const MINI_TICKET_LINK = String(config.ticketMiniLink || '').trim();
const LEGACY_TICKET_LINK = String(config.ticketLegacyLink || '').trim();

const NEARBY = [
  { key: 'food-1', category: 'food', title: '附近美食', label: '餐饮推荐位', mark: '食', meta: '早餐 · 正餐 · 茶饮', image: '/images/arc/arc-colonnade.jpg' },
  { key: 'hotel-1', category: 'hotel', title: '附近住宿', label: '住宿推荐位', mark: '宿', meta: '民宿 · 酒店 · 客栈', image: '/images/arc/arc-garden-moon.jpg' },
  { key: 'food-2', category: 'food', title: '附近美食', label: '餐饮推荐位', mark: '食', meta: '小吃 · 甜品 · 咖啡', image: '/images/arc/arc-gable.jpg' },
];

const PLACEHOLDER = /待接入|待确认|待景区|以景区最新公告为准/;

function isPending(value) {
  const text = String(value || '').trim();
  return !text || PLACEHOLDER.test(text);
}

function buildServiceMeta(service) {
  const source = service || {};
  return {
    addressPending: isPending(source.address),
    transportPending: isPending(source.transport),
    openingPending: isPending(source.openingHours),
    phonePending: isPending(source.phone),
  };
}

function resolveTicketLinks(ticket) {
  const apiUrl = ticket && typeof ticket.url === 'string' ? ticket.url.trim() : '';
  return {
    miniLink: /^#小程序:\/\//.test(apiUrl) ? apiUrl : MINI_TICKET_LINK,
    legacyLink: /^https?:\/\//i.test(apiUrl) ? apiUrl : LEGACY_TICKET_LINK,
  };
}

function resolveTicketState(ticket, links) {
  if (ticket && ticket.appId && (ticket.enabled === true || Boolean(ticket.path))) return 'open';
  if (links && (links.miniLink || links.legacyLink)) return 'link';
  return 'pending';
}

function ticketStateLine(state) {
  if (state === 'open') return '官方购票渠道已接入';
  if (state === 'link') return '官方购票入口已提供，可复制链接打开';
  return '订票入口尚未开放';
}

function ticketPrimaryLabel(state) {
  if (state === 'open') return '微信内打开官方购票';
  if (state === 'link') return '查看官方购票入口';
  return '订票入口准备中';
}

Page({
  data: {
    service: null,
    loading: true,
    error: '',
    displayClass: '',
    ticketMiniLink: '',
    ticketLegacyLink: '',
    ticketHasLink: false,
    ticketSecondaryLabel: '',
    ticketState: 'pending',
    ticketStateLine: '订票入口尚未开放',
    ticketPrimaryLabel: '订票入口准备中',
    ticketStates: TICKET_STATES,
    serviceMeta: { addressPending: true, transportPending: true, openingPending: true, phonePending: true },
    ticketSheet: false,
    ticketSheetMode: 'link',
    ticketSheetLede: '',
    copiedKey: '',
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
      const links = resolveTicketLinks(ticket);
      const ticketState = resolveTicketState(ticket, links);
      const ticketSecondaryLabel = links.miniLink ? '复制新版链接' : (links.legacyLink ? '复制旧版链接' : '');
      this.loaded = true;
      this.setData({
        service,
        serviceMeta: buildServiceMeta(service),
        loading: false,
        ticketMiniLink: links.miniLink,
        ticketLegacyLink: links.legacyLink,
        ticketHasLink: Boolean(links.miniLink || links.legacyLink),
        ticketSecondaryLabel,
        ticketState,
        ticketStateLine: ticketStateLine(ticketState),
        ticketPrimaryLabel: ticketPrimaryLabel(ticketState),
      });
    } catch (error) {
      this.setData({ loading: false, error: getErrorMessage(error, '服务信息加载失败，请稍后重试。') });
    }
  },
  handleTicket() {
    const state = this.data.ticketState;
    if (state === 'pending') {
      wx.showModal({
        title: '订票入口准备中',
        content: '官方购票平台尚未配置。本小程序不代售、不收款，请以景区最新公告为准。',
        showCancel: false,
      });
      return;
    }
    if (state === 'link') {
      this.openTicketSheet('link');
      return;
    }
    const ticket = (this.data.service && this.data.service.ticket) || {};
    wx.navigateToMiniProgram({
      appId: ticket.appId,
      path: ticket.path || '',
      success: () => {
        this.setData({ ticketState: 'open', ticketStateLine: ticketStateLine('open') });
      },
      fail: () => {
        this.setData({
          ticketState: 'link',
          ticketStateLine: ticketStateLine('link'),
          ticketPrimaryLabel: ticketPrimaryLabel('link'),
          ticketSecondaryLabel: this.data.ticketMiniLink ? '复制新版链接' : (this.data.ticketLegacyLink ? '复制旧版链接' : ''),
        });
        this.openTicketSheet('failed');
      },
    });
  },
  copyTicketLink() {
    const link = this.data.ticketMiniLink || this.data.ticketLegacyLink;
    if (!link) {
      this.openTicketSheet('link');
      return;
    }
    wx.setClipboardData({
      data: link,
      success: () => wx.showToast({ title: '购票链接已复制', icon: 'none' }),
    });
  },
  openTicketSheet(mode) {
    const hasMini = Boolean(this.data.ticketMiniLink);
    const lede = mode === 'failed'
      ? '小程序跳转失败，或业务域名尚未配置。你可以复制下方链接，在微信内打开后粘贴访问。'
      : (hasMini
        ? '新版购票小程序链接复制后，请粘贴到微信聊天窗口发送，再点击小程序卡片进入；旧版链接可直接在微信或浏览器打开。'
        : '购票链接复制后，可在微信或浏览器中粘贴打开。');
    this.setData({
      ticketSheet: true,
      ticketSheetMode: mode,
      ticketSheetLede: lede,
      copiedKey: '',
    });
  },
  closeTicketSheet() {
    this.setData({ ticketSheet: false });
  },
  copyTicketLinkFromSheet(event) {
    const kind = event.currentTarget.dataset.kind;
    const link = kind === 'legacy' ? this.data.ticketLegacyLink : this.data.ticketMiniLink;
    if (!link) {
      this.showPending('购票链接尚未配置');
      return;
    }
    wx.setClipboardData({
      data: link,
      success: () => this.setData({ copiedKey: kind }),
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
  openFeedback() {
    wx.navigateTo({
      url: '/pages/feedback/index',
      fail: () => wx.showToast({ title: '页面打开失败，请稍后重试', icon: 'none' }),
    });
  },
  noop() {},
});
