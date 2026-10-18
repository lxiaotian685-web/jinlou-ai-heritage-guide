const { getSpots, getSiteMap, getErrorMessage } = require('../../services/api');
const { getFavoriteSpotIds, toggleFavoriteSpot, clearFavoriteSpotIds } = require('../../utils/favorites');
const { getVisitedSpotIds, toggleVisitedSpot, clearVisitedSpotIds } = require('../../utils/visit-progress');
const { buildRouteProgress } = require('../../utils/route-progress');
const { getDisplaySettings, saveDisplaySettings, getDisplayClass } = require('../../utils/display-settings');
const { getRecentSpotIds, clearRecentSpots } = require('../../utils/recent-spots');
const { getAllSpotNotes, clearSpotNotes } = require('../../utils/spot-notes');

function getValidIds(ids, spots) {
  const validIds = new Set(spots.map((spot) => spot.id));
  return ids.filter((id) => validIds.has(id));
}

function buildCenterState(spots, sitePoints) {
  const favoriteIds = getValidIds(getFavoriteSpotIds(), spots);
  const visitedIds = getValidIds(getVisitedSpotIds(), spots);
  const favorites = new Set(favoriteIds);
  const visited = new Set(visitedIds);
  const spotById = new Map(spots.map((spot) => [spot.id, spot]));
  const notes = getAllSpotNotes();
  const selectedRoute = wx.getStorageSync('selectedTourRoute') || null;
  return {
    favoriteSpots: spots.filter((spot) => favorites.has(spot.id)),
    visitedSpots: spots.filter((spot) => visited.has(spot.id)),
    recentSpots: getRecentSpotIds().map((id) => spotById.get(id)).filter(Boolean),
    notedSpots: Object.entries(notes).map(([id, note]) => {
      const spot = spotById.get(id);
      return spot ? { ...spot, rating: Number(note.rating) || 0, ratingText: note.rating ? `${note.rating} 星` : '未评分', noteText: String(note.text || '') } : null;
    }).filter(Boolean).sort((left, right) => right.rating - left.rating),
    visitedCount: visitedIds.length,
    totalCount: spots.length,
    progressPercent: spots.length ? Math.round(visitedIds.length / spots.length * 100) : 0,
    selectedRoute,
    routeProgress: buildRouteProgress(selectedRoute, sitePoints, visitedIds),
  };
}

Page({
  data: {
    spots: [], sitePoints: [], favoriteSpots: [], visitedSpots: [], recentSpots: [], notedSpots: [],
    visitedCount: 0, totalCount: 0, progressPercent: 0,
    selectedRoute: null, routeProgress: null,
    offlineNotice: '', loading: true, error: '',
    displayClass: '', displaySettings: { fontSize: 'normal', highContrast: false },
  },
  onLoad() { this.loadData(); },
  onShow() {
    this.setData({ displayClass: getDisplayClass(), displaySettings: getDisplaySettings() });
    if (this.data.spots.length) this.refreshLocalState();
  },
  setFontSize(event) {
    const displaySettings = saveDisplaySettings({ fontSize: event.currentTarget.dataset.size });
    this.setData({ displaySettings, displayClass: getDisplayClass() });
  },
  toggleContrast() {
    const displaySettings = saveDisplaySettings({ highContrast: !this.data.displaySettings.highContrast });
    this.setData({ displaySettings, displayClass: getDisplayClass() });
  },
  async loadData() {
    this.setData({ loading: true, error: '', offlineNotice: '' });
    try {
      const [spotResult, mapResult] = await Promise.all([getSpots(), getSiteMap()]);
      const spots = spotResult.data;
      const sitePoints = mapResult.data;
      this.setData({
        spots, sitePoints,
        ...buildCenterState(spots, sitePoints),
        offlineNotice: spotResult._cache?.notice || mapResult._cache?.notice || '',
        loading: false,
      });
    } catch (error) {
      this.setData({ loading: false, error: getErrorMessage(error, '暂时无法读取游览资料。') });
    }
  },
  refreshLocalState() {
    this.setData(buildCenterState(this.data.spots, this.data.sitePoints));
  },
  openSpot(event) {
    wx.navigateTo({ url: `/pages/spot-detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` });
  },
  removeFavorite(event) {
    toggleFavoriteSpot(event.currentTarget.dataset.id);
    this.refreshLocalState();
  },
  removeVisited(event) {
    toggleVisitedSpot(event.currentTarget.dataset.id);
    this.refreshLocalState();
  },
  openRoute() {
    wx.switchTab({ url: '/pages/guide/index' });
  },
  clearRoute() {
    wx.showModal({
      title: '清除当前路线？', content: '收藏和已游览记录不会受到影响。',
      success: ({ confirm }) => {
        if (!confirm) return;
        wx.removeStorageSync('selectedTourRoute');
        this.refreshLocalState();
      },
    });
  },
  clearFavorites() {
    this.confirmClear('清空全部收藏？', '只会清除当前手机保存的收藏。', () => clearFavoriteSpotIds());
  },
  clearVisited() {
    this.confirmClear('清空游览记录？', '15点进度会恢复为0，收藏和路线不受影响。', () => clearVisitedSpotIds());
  },
  clearNotes() {
    this.confirmClear('清空全部私人记录？', '所有景点评分和私人笔记都会被清除，收藏与游览进度不受影响。', () => clearSpotNotes());
  },
  clearAll() {
    this.confirmClear('清空全部本机游览记录？', '收藏、已游览进度、当前路线、最近浏览和私人记录都会被清除，且无法撤销。', () => {
      clearFavoriteSpotIds();
      clearVisitedSpotIds();
      clearSpotNotes();
      clearRecentSpots();
      wx.removeStorageSync('selectedTourRoute');
    });
  },
  openPrivacy() { wx.navigateTo({ url: '/pages/privacy/index' }); },
  confirmClear(title, content, action) {
    wx.showModal({
      title, content, confirmColor: '#9a4d3f',
      success: ({ confirm }) => {
        if (!confirm) return;
        action();
        this.refreshLocalState();
        wx.showToast({ title: '已清除', icon: 'none' });
      },
    });
  },
});
