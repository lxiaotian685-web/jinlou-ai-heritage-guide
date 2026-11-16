const { getService, getErrorMessage } = require('../../services/api');
const { getDisplayClass } = require('../../utils/display-settings');
const config = require('../../config');

const TICKET_STATES = [
  { key: 'guide', index: '01', name: '使用说明', meta: '复制后在微信打开' },
  { key: 'link', index: '02', name: '复制链接', meta: '新版购票小程序' },
  { key: 'official', index: '03', name: '官方平台', meta: '票价退改以其为准' },
];

const CONFIRMED_SERVICE = {
  address: '广东省佛山市顺德区北滘镇碧江社区泰宁西路6号',
  openingHours: '每日08:30—17:00；停止入园时间及临时闭园安排请以景区当日公告为准',
  phone: '0757-26632123',
  transport: '公交可在德云市场站下车后步行前往；具体线路、停车位置及实时路况请以地图导航和景区公告为准。',
  latitude: 22.942558,
  longitude: 113.262272,
};

const MINI_TICKET_LINK = String(config.ticketMiniLink || '').trim();
const LEGACY_TICKET_LINK = String(config.ticketLegacyLink || '').trim();

const NEARBY = [
  { key: 'food-1', category: 'food', title: '顺德美食', label: '双皮奶与鱼皮', mark: '食', meta: '顺德特色 · 到店前核实', note: '美食示意图', image: '/images/arc/arc-colonnade.jpg' },
  { key: 'hotel-1', category: 'hotel', title: '附近住宿', label: '拾光美宿酒店', mark: '宿', meta: '北滘碧江店 · 约700米', note: '房型示意图', image: '/images/arc/arc-garden-moon.jpg' },
  { key: 'attraction-1', category: 'attraction', title: '周边景点', label: '清晖园', mark: '园', meta: '岭南园林 · 大良清晖路', note: '景观示意图', image: '/images/arc/arc-gable.jpg' },
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

function mergeConfirmedService(service) {
  const source = service || {};
  const actions = source.actions || {};
  const merged = { ...source };
  for (const [key, value] of Object.entries(CONFIRMED_SERVICE)) {
    if (key === 'latitude' || key === 'longitude') {
      if (merged[key] === null || merged[key] === '' || !Number.isFinite(Number(merged[key]))) merged[key] = value;
    } else if (isPending(merged[key])) {
      merged[key] = value;
    }
  }
  merged.actions = {
    ...actions,
    copyAddress: true,
    callPhone: true,
    openMap: true,
  };
  return merged;
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
    ticketState: 'guide',
    ticketStateLine: '复制新版链接后，在微信聊天窗口粘贴发送并点击卡片',
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
      const service = mergeConfirmedService(result.data);
      const ticket = service.ticket || {};
      const links = resolveTicketLinks(ticket);
      const ticketState = links.miniLink || links.legacyLink ? 'link' : 'guide';
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
        ticketStateLine: ticketState === 'link'
          ? '复制新版链接后，在微信聊天窗口粘贴发送并点击卡片'
          : '请以景区最新公布的官方购票渠道为准',
      });
    } catch (error) {
      this.setData({ loading: false, error: getErrorMessage(error, '服务信息加载失败，请稍后重试。') });
    }
  },
  copyTicketLink() {
    const link = this.data.ticketMiniLink || this.data.ticketLegacyLink;
    if (!link) {
      this.openTicketSheet('link');
      return;
    }
    wx.setClipboardData({
      data: link,
      success: () => wx.showToast({
        title: this.data.ticketMiniLink ? '小程序链接已复制，请粘贴到微信聊天发送' : '购票链接已复制',
        icon: 'none',
      }),
      fail: () => wx.showToast({ title: '复制失败，请长按链接手动复制', icon: 'none' }),
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
      fail: () => wx.showToast({ title: '复制失败，请长按链接手动复制', icon: 'none' }),
    });
  },
  copyAddress() {
    const service = this.data.service || {};
    const actions = service.actions || {};
    if (!actions.copyAddress) return this.showPending('正式地址尚未配置');
    wx.setClipboardData({
      data: service.address,
      fail: () => this.showPending('复制失败，请稍后重试'),
    });
  },
  callPhone() {
    const service = this.data.service || {};
    const actions = service.actions || {};
    if (!actions.callPhone) return this.showPending('正式联系电话尚未配置');
    wx.makePhoneCall({
      phoneNumber: service.phone,
      fail: (error) => {
        if (/cancel/i.test((error && error.errMsg) || '')) return;
        this.showPending('无法拨打电话，请稍后重试');
      },
    });
  },
  openMap() {
    const service = this.data.service || {};
    const actions = service.actions || {};
    if (!actions.openMap) return this.showPending('地图坐标尚未配置');
    wx.openLocation({
      latitude: service.latitude,
      longitude: service.longitude,
      name: '碧江金楼',
      address: service.address,
      fail: () => this.showPending('无法打开地图，请稍后重试'),
    });
  },
  showPending(message) {
    wx.showToast({ title: message, icon: 'none' });
  },
  openRecommendations(event) {
    const { category, title } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/recommendations/index?category=${category}&title=${encodeURIComponent(title)}`,
      fail: () => wx.showToast({ title: '页面打开失败，请稍后重试', icon: 'none' }),
    });
  },
  openFeedback() {
    wx.navigateTo({
      url: '/pages/feedback/index',
      fail: () => wx.showToast({ title: '页面打开失败，请稍后重试', icon: 'none' }),
    });
  },
  noop() {},
});
