const { getDisplaySettings, saveDisplaySettings, getDisplayClass } = require('../../utils/display-settings');
const { getHome, getSiteMap } = require('../../services/api');
const { getVisitedSpotIds } = require('../../utils/visit-progress');
const { buildRouteProgress } = require('../../utils/route-progress');

const DEFAULT_HERO_IMAGES = [
  '/images/jinlou-home-slide-1.jpg',
  '/images/jinlou-home-slide-2.jpg',
  '/images/jinlou-home-slide-3.jpg',
  '/images/jinlou-home-slide-4.jpg',
  '/images/jinlou-home-slide-5.jpg',
  '/images/jinlou-home-slide-6.jpg',
];

const DEFAULT_HERO_SLIDES = buildHeroSlides();

function buildHeroSlides(primaryImage, configuredImages) {
  const images = Array.isArray(configuredImages) && configuredImages.length
    ? configuredImages.slice(0, 8)
    : (primaryImage && primaryImage !== '/images/jinlou-home-hero-v2.jpg' ? [primaryImage, ...DEFAULT_HERO_IMAGES] : DEFAULT_HERO_IMAGES);
  return images.map((image, index) => ({
    image,
    previousImage: images[(index - 1 + images.length) % images.length],
    nextImage: images[(index + 1) % images.length],
  }));
}

Page({
  data: {
    continueCard: null,
    home: {
      heroImage: DEFAULT_HERO_IMAGES[0],
      title: '一座金楼，半部岭南往事',
      subtitle: '循着木雕、园林与旧宅，慢慢走进碧江。',
    },
    heroSlides: DEFAULT_HERO_SLIDES,
    activeHero: DEFAULT_HERO_SLIDES[0],
    heroCurrent: 0,
    displaySettings: { fontSize: 'normal', highContrast: false },
  },
  onLoad() {
    if (wx.getStorageSync('onboardingSeen')) return;
    wx.setStorageSync('onboardingSeen', true);
    wx.showModal({ title: '欢迎使用碧江金楼导览', content: '你可以查看景点、收藏和标记已游览，选择参考路线，并在“我的游览”集中查看进度。', showCancel: false });
  },
  onShow() {
    this.setData({ displayClass: getDisplayClass(), displaySettings: getDisplaySettings() });
    this.loadHome();
    this.loadContinueCard();
  },
  async loadHome() {
    try {
      const result = await getHome();
      if (result?.data) {
        const home = { ...this.data.home, ...result.data };
        const heroSlides = buildHeroSlides(home.heroImage, home.heroImages);
        this.setData({ home, heroSlides, activeHero: heroSlides[0], heroCurrent: 0 });
      }
    } catch (_error) {
      // 云端首页配置未启用时保留包内默认图和文字。
    }
  },
  handleHeroChange(event) {
    const heroCurrent = event.detail.current;
    this.setData({ heroCurrent, activeHero: this.data.heroSlides[heroCurrent] || null });
  },
  toggleFontSize() {
    const fontSize = this.data.displaySettings.fontSize === 'large' ? 'normal' : 'large';
    const displaySettings = saveDisplaySettings({ fontSize });
    this.setData({ displaySettings, displayClass: getDisplayClass() });
  },
  async loadContinueCard() {
    const selectedRoute = wx.getStorageSync('selectedTourRoute') || null;
    if (!selectedRoute) return this.setData({ continueCard: null });
    try {
      const mapResult = await getSiteMap();
      const progress = buildRouteProgress(selectedRoute, mapResult.data, getVisitedSpotIds());
      this.setData({ continueCard: {
        type: 'route', title: selectedRoute.name,
        description: progress?.isComplete ? '这条路线已经全部完成' : `已完成 ${progress?.completedCount || 0}/${progress?.totalCount || 0}${progress?.currentStop ? ` · 当前：${progress.currentStop.name}` : ''}`,
        buttonText: '继续路线',
      } });
    } catch (_error) {
      this.setData({ continueCard: { type: 'route', title: selectedRoute.name, description: '路线进度暂时无法读取', buttonText: '继续路线' } });
    }
  },
  continueVisit() {
    if (this.data.continueCard) wx.switchTab({ url: '/pages/guide/index' });
  },
  onShareAppMessage() {
    return { title: '碧江金楼智慧导览', path: '/pages/index/index' };
  },
  onShareTimeline() {
    return { title: '碧江金楼智慧导览' };
  },
  goToSpots() {
    wx.navigateTo({ url: '/pages/spots/index' });
  },
  goToArStudy() {
    wx.switchTab({ url: '/pages/panoramas/index' });
  },
  goToAssistant() {
    wx.navigateTo({ url: '/pages/assistant/index' });
  },
  goToVisitCenter() {
    wx.navigateTo({ url: '/pages/visit-center/index' });
  },
});
