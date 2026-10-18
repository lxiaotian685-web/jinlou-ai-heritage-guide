const { getSpots, getErrorMessage } = require('../../services/api');
const { getFavoriteSpotIds } = require('../../utils/favorites');
const { getVisitedSpotIds } = require('../../utils/visit-progress');
const { getDisplayClass } = require('../../utils/display-settings');

function addNamePronunciation(spot) {
  return {
    ...spot,
    namePronunciation: spot.name.includes('镬') ? '镬（huò）' : '',
  };
}

function filterSpots(spots, filters) {
  const query = filters.keyword.trim().toLowerCase();
  const favorites = new Set(filters.favoriteIds);
  const visited = new Set(filters.visitedIds);
  const filtered = spots.filter((spot) => {
    const matchesCategory = filters.activeCategory === '全部' || spot.category === filters.activeCategory;
    const searchableText = `${spot.name} ${spot.category} ${spot.summary}`.toLowerCase();
    const matchesFavorite = !filters.favoritesOnly || favorites.has(spot.id);
    const matchesVisit = !filters.unvisitedOnly || !visited.has(spot.id);
    return matchesCategory && matchesFavorite && matchesVisit && (!query || searchableText.includes(query));
  }).map((spot) => ({
    ...spot,
    isFavorite: favorites.has(spot.id),
    isVisited: visited.has(spot.id),
  }));
  if (filters.sortMode === 'unvisited') return filtered.sort((left, right) => Number(left.isVisited) - Number(right.isVisited));
  if (filters.sortMode === 'favorite') return filtered.sort((left, right) => Number(right.isFavorite) - Number(left.isFavorite));
  if (filters.sortMode === 'name') return filtered.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
  return filtered;
}

function getValidVisitedIds(spots) {
  const spotIds = new Set(spots.map((spot) => spot.id));
  return getVisitedSpotIds().filter((id) => spotIds.has(id));
}

function getProgressPercent(visitedCount, total) {
  return total ? Math.round(visitedCount / total * 100) : 0;
}

Page({
  data: {
    spots: [],
    filteredSpots: [],
    categories: ['全部'],
    activeCategory: '全部',
    keyword: '',
    favoriteIds: [],
    favoritesOnly: false,
    visitedIds: [],
    unvisitedOnly: false,
    sortMode: 'default',
    sortOptions: [{ id: 'default', label: '默认' }, { id: 'unvisited', label: '未游览优先' }, { id: 'favorite', label: '收藏优先' }, { id: 'name', label: '名称' }],
    progressPercent: 0,
    offlineNotice: '',
    loading: true,
    error: '',
  },
  onLoad() { this.loadSpots(); },
  onShow() {
    const favoriteIds = getFavoriteSpotIds();
    const visitedIds = getValidVisitedIds(this.data.spots);
    this.setData({
      displayClass: getDisplayClass(),
      favoriteIds,
      visitedIds,
      progressPercent: getProgressPercent(visitedIds.length, this.data.spots.length),
      filteredSpots: filterSpots(this.data.spots, { ...this.data, favoriteIds, visitedIds }),
    });
  },
  async loadSpots() {
    this.setData({ loading: true, error: '', offlineNotice: '' });
    try {
      const result = await getSpots();
      const spots = result.data.map(addNamePronunciation);
      const categories = ['全部', ...new Set(spots.map((spot) => spot.category))];
      const favoriteIds = getFavoriteSpotIds();
      const visitedIds = getValidVisitedIds(spots);
      const initialFilters = {
        keyword: '', activeCategory: '全部', favoritesOnly: false, favoriteIds, unvisitedOnly: false, visitedIds, sortMode: this.data.sortMode,
      };
      this.setData({
        spots,
        filteredSpots: filterSpots(spots, initialFilters),
        categories,
        activeCategory: '全部',
        keyword: '',
        favoriteIds,
        favoritesOnly: false,
        visitedIds,
        unvisitedOnly: false,
        progressPercent: getProgressPercent(visitedIds.length, spots.length),
        offlineNotice: result._cache?.notice || '',
        loading: false,
      });
    } catch (error) {
      this.setData({ loading: false, error: getErrorMessage(error, '暂时无法读取景点。') });
    }
  },
  handleSearch(event) {
    const keyword = event.detail.value;
    this.setData({
      keyword,
      filteredSpots: filterSpots(this.data.spots, { ...this.data, keyword }),
    });
  },
  selectCategory(event) {
    const activeCategory = event.currentTarget.dataset.category;
    this.setData({
      activeCategory,
      filteredSpots: filterSpots(this.data.spots, { ...this.data, activeCategory }),
    });
  },
  toggleFavoritesOnly() {
    const favoritesOnly = !this.data.favoritesOnly;
    this.setData({
      favoritesOnly,
      filteredSpots: filterSpots(this.data.spots, { ...this.data, favoritesOnly }),
    });
  },
  toggleUnvisitedOnly() {
    const unvisitedOnly = !this.data.unvisitedOnly;
    this.setData({
      unvisitedOnly,
      filteredSpots: filterSpots(this.data.spots, { ...this.data, unvisitedOnly }),
    });
  },
  selectSort(event) {
    const sortMode = event.currentTarget.dataset.sort;
    this.setData({ sortMode, filteredSpots: filterSpots(this.data.spots, { ...this.data, sortMode }) });
  },
  resetFilters() {
    this.setData({
      keyword: '',
      activeCategory: '全部',
      favoritesOnly: false,
      unvisitedOnly: false,
      sortMode: 'default',
      filteredSpots: filterSpots(this.data.spots, {
        ...this.data, keyword: '', activeCategory: '全部', favoritesOnly: false, unvisitedOnly: false, sortMode: 'default',
      }),
    });
  },
  openSpot(event) {
    wx.navigateTo({ url: `/pages/spot-detail/index?id=${event.currentTarget.dataset.id}` });
  },
});
