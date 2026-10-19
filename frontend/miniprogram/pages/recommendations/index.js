const { getRecommendations, trackRecommendation, getErrorMessage } = require('../../services/api');
const { getDisplayClass, getDisplaySettings, saveDisplaySettings } = require('../../utils/display-settings');

const CATEGORY_KEYS = ['food', 'hotel', 'transport', 'attraction'];
const CATEGORY_META = {
  food: { key: 'food', label: '美食', en: 'FOOD', navTitle: '附近美食', headline: '这一带还没有收录美食线索' },
  hotel: { key: 'hotel', label: '酒店', en: 'STAY', navTitle: '附近酒店', headline: '这一带还没有收录住宿线索' },
  transport: { key: 'transport', label: '交通', en: 'TRANSIT', navTitle: '交通出行', headline: '这一带还没有收录交通线索' },
  attraction: { key: 'attraction', label: '景点', en: 'SITE', navTitle: '周边景点', headline: '这一带还没有收录景点线索' },
};
const CATEGORY_LIST = CATEGORY_KEYS.map((key) => CATEGORY_META[key]);
const EMPTY_BODY = '景区尚未提供可核实的商户资料。我们不想用猜测填满这一栏。';
const PLACEHOLDER = /待接入|待确认|待景区/;
const PHONE_PATTERN = /^[0-9+\-\s()]{5,}$/;
const LINK_PATTERN = /^https?:\/\//i;

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function orderValue(value) {
  if (value === null || value === undefined || value === '') return Number.POSITIVE_INFINITY;
  const order = Number(value);
  return Number.isFinite(order) ? order : Number.POSITIVE_INFINITY;
}

function normalizeItem(raw, indexText, category) {
  const source = raw || {};
  const meta = CATEGORY_META[category] || CATEGORY_META.food;
  const status = text(source.status).toLowerCase();
  const name = text(source.name);
  const type = text(source.type);
  const address = text(source.address);
  const availability = text(source.availability);
  const description = text(source.description);
  const productName = text(source.productName);
  const sourceNote = text(source.sourceNote);
  const image = text(source.image);
  const phone = text(source.phone);
  const linkUrl = text(source.linkUrl);
  const latitudeText = text(source.latitude);
  const longitudeText = text(source.longitude);
  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);
  const hasLocation = Boolean(latitudeText && longitudeText)
    && Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180
    && !(latitude === 0 && longitude === 0);
  const reviewText = [name || '名称待景区补充', type, address, availability, description, productName, sourceNote].join(' ');

  return {
    id: source.id,
    category,
    categoryLabel: meta.label,
    categoryEn: meta.en,
    indexText,
    name: name || '名称待景区补充',
    type,
    address,
    availability,
    description,
    productName,
    image,
    showImage: category === 'attraction' && Boolean(image),
    phone,
    hasPhone: PHONE_PATTERN.test(phone),
    linkUrl,
    hasLink: LINK_PATTERN.test(linkUrl),
    sourceText: sourceNote || '景区接口',
    needsReview: status !== 'online' || PLACEHOLDER.test(reviewText),
    hasFacts: Boolean(type || address || availability),
    latitude: hasLocation ? latitude : null,
    longitude: hasLocation ? longitude : null,
    hasLocation,
  };
}

function buildItems(result, category) {
  const list = Array.isArray(result) ? result : [];
  const visible = list
    .map((item, apiIndex) => ({ item: item || {}, apiIndex }))
    .filter(({ item }) => {
      const status = text(item.status).toLowerCase();
      return !status || status === 'online' || status === 'pending-review';
    })
    .sort((a, b) => {
      const orderA = orderValue(a.item.sortOrder);
      const orderB = orderValue(b.item.sortOrder);
      if (orderA !== orderB) return orderA - orderB;
      return a.apiIndex - b.apiIndex;
    });

  return visible.map(({ item }, index) => normalizeItem(
    item,
    String(index + 1).padStart(2, '0'),
    category
  ));
}

Page({
  data: {
    title: '附近推荐',
    categories: CATEGORY_LIST,
    activeCategory: 'food',
    activeMeta: CATEGORY_META.food,
    emptyState: { headline: CATEGORY_META.food.headline, body: EMPTY_BODY },
    items: [],
    loading: true,
    error: '',
    activeItem: null,
    displayClass: '',
    isLarge: false,
  },

  onLoad(options) {
    const params = options || {};
    const requested = CATEGORY_KEYS.includes(params.category) ? params.category : 'food';
    this.category = requested;

    let title = '附近推荐';
    if (params.title) {
      try {
        title = decodeURIComponent(params.title);
      } catch (_error) {
        title = params.title;
      }
    }
    wx.setNavigationBarTitle({ title });

    this.setData({
      title,
      categories: CATEGORY_LIST,
      activeCategory: requested,
      activeMeta: CATEGORY_META[requested],
      emptyState: { headline: CATEGORY_META[requested].headline, body: EMPTY_BODY },
      displayClass: getDisplayClass(),
      isLarge: getDisplaySettings().fontSize === 'large',
    });
    this.loadRecommendations();
  },

  onShow() {
    this.setData({
      displayClass: getDisplayClass(),
      isLarge: getDisplaySettings().fontSize === 'large',
    });
  },

  switchCategory(event) {
    const category = event.currentTarget.dataset.key;
    if (!CATEGORY_META[category] || category === this.data.activeCategory) return;
    const meta = CATEGORY_META[category];
    this.category = category;
    wx.setNavigationBarTitle({ title: meta.navTitle });
    this.setData({
      activeCategory: category,
      activeMeta: meta,
      emptyState: { headline: meta.headline, body: EMPTY_BODY },
      items: [],
      loading: true,
      error: '',
      activeItem: null,
    });
    this.loadRecommendations();
  },

  async loadRecommendations() {
    const category = this.data.activeCategory || this.category || 'food';
    const requestId = (this.requestId || 0) + 1;
    this.requestId = requestId;
    this.setData({ loading: true, error: '' });

    try {
      const result = await getRecommendations(category);
      if (requestId !== this.requestId) return;
      this.setData({ items: buildItems(result && result.data, category), loading: false });
    } catch (error) {
      if (requestId !== this.requestId) return;
      this.setData({
        items: [],
        activeItem: null,
        loading: false,
        error: getErrorMessage(error, '推荐内容加载失败，请稍后重试。'),
      });
    }
  },

  onImageError(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index)) return;
    const item = this.data.items[index];
    if (!item || !item.showImage) return;
    this.setData({ [`items[${index}].showImage`]: false });
  },

  showDetail(event) {
    const dataset = event.currentTarget.dataset;
    const hasId = dataset.id !== null && dataset.id !== undefined && dataset.id !== '';
    let activeItem = hasId
      ? this.data.items.find((item) => String(item.id) === String(dataset.id))
      : null;
    if (!activeItem) {
      const index = Number(dataset.index);
      activeItem = Number.isInteger(index) ? this.data.items[index] : null;
    }
    this.setData({ activeItem: activeItem || null });
    if (activeItem) this.trackAction(activeItem.id, 'detail');
  },

  trackAction(itemId, action) {
    if (itemId === null || itemId === undefined || itemId === '') return;
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
    const item = this.data.activeItem;
    const phone = item ? item.phone : '';
    if (!item || !PHONE_PATTERN.test(phone)) {
      wx.showToast({ title: '商家电话待接入', icon: 'none' });
      return;
    }
    wx.makePhoneCall({
      phoneNumber: phone,
      success: () => this.trackAction(item.id, 'phone'),
    });
  },

  copyMerchantLink() {
    const item = this.data.activeItem;
    const link = item ? item.linkUrl : '';
    if (!item || !LINK_PATTERN.test(link)) {
      wx.showToast({ title: '商家链接待接入', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: link,
      success: () => this.trackAction(item.id, 'link'),
    });
  },

  showCluePending() {
    wx.showModal({
      title: '线索提交尚未开放',
      content: '我们还没有开通商户线索提交入口。正式开放前，不会代填或推测任何商户资料。',
      showCancel: false,
      confirmText: '知道了',
    });
  },

  backToService() {
    wx.navigateBack({ delta: 1 });
  },

  toggleLargeText() {
    const isLarge = !this.data.isLarge;
    saveDisplaySettings({ fontSize: isLarge ? 'large' : 'normal' });
    this.setData({
      isLarge,
      displayClass: getDisplayClass(),
    });
  },
});
