const { getSiteMap } = require('../../services/api');
const { getVisitedSpotIds } = require('../../utils/visit-progress');
const { buildRouteProgress } = require('../../utils/route-progress');
const { getDisplayClass } = require('../../utils/display-settings');

const MAP_V2_POINT_POSITIONS = {
  4: [70, 21],
  8: [82, 55],
  9: [50, 44],
  13: [38, 20],
  14: [17, 63],
};

function applyMapV2Position(point, numberKey = 'number') {
  const position = MAP_V2_POINT_POSITIONS[point?.[numberKey]];
  return position ? { ...point, positionX: position[0], positionY: position[1] } : point;
}

function getRouteState(selectedRoute, sitePoints) {
  const routeProgress = buildRouteProgress(selectedRoute, sitePoints, getVisitedSpotIds());
  if (!routeProgress) return { routeProgress: null, routeDisplayPoints: [] };
  const routeDisplayPoints = routeProgress.points.map((point) => applyMapV2Position(point, 'siteNumber'));
  return {
    routeProgress: {
      ...routeProgress,
      points: routeDisplayPoints,
      currentStop: routeProgress.currentStop ? applyMapV2Position(routeProgress.currentStop, 'siteNumber') : null,
      nextStop: routeProgress.nextStop ? applyMapV2Position(routeProgress.nextStop, 'siteNumber') : null,
    },
    routeDisplayPoints,
  };
}

Page({
  data: {
    selectedRoute: null,
    routeProgress: null,
    routeDisplayPoints: [],
    sitePoints: [],
    activePoint: null,
    mapNotice: '',
    mapMeta: null,
    offlineNotice: '',
    mapLoading: true,
  },
  onLoad() {
    this.loadSiteMap();
  },
  onShow() {
    const selectedRoute = wx.getStorageSync('selectedTourRoute') || null;
    this.setData({ displayClass: getDisplayClass(), selectedRoute, ...getRouteState(selectedRoute, this.data.sitePoints) }, () => this.drawRoute());
  },
  openSpots() {
    wx.navigateTo({ url: '/pages/spots/index' });
  },
  openRoutes() {
    wx.navigateTo({ url: '/pages/routes/index' });
  },
  async loadSiteMap() {
    try {
      const result = await getSiteMap();
      const sitePoints = result.data.map((point) => applyMapV2Position(point));
      this.setData({
        sitePoints,
        mapNotice: result.meta.notice,
        mapMeta: result.meta,
        offlineNotice: result._cache?.notice || '',
        mapLoading: false,
        ...getRouteState(this.data.selectedRoute, sitePoints),
      }, () => this.drawRoute());
    } catch (_error) {
      this.setData({ mapLoading: false, mapNotice: '现场点位暂时无法读取，请确认后端已启动。', offlineNotice: '' });
    }
  },
  clearRoute() {
    wx.removeStorageSync('selectedTourRoute');
    this.setData({ selectedRoute: null, routeProgress: null, routeDisplayPoints: [] }, () => this.drawRoute());
  },
  selectPoint(event) {
    const activePoint = this.data.sitePoints.find((item) => item.number === Number(event.currentTarget.dataset.number));
    if (activePoint) this.setData({ activePoint });
  },
  clearPoint() {
    this.setData({ activePoint: null });
  },
  openPointSpot() {
    const spotId = this.data.activePoint?.spotId;
    if (!spotId) return;
    wx.navigateTo({ url: `/pages/spot-detail/index?id=${encodeURIComponent(spotId)}` });
  },
  openCurrentStop() {
    const spotId = this.data.routeProgress?.currentStop?.spotId;
    if (!spotId) return wx.showToast({ title: '当前站点暂时无法打开', icon: 'none' });
    return wx.navigateTo({ url: `/pages/spot-detail/index?id=${encodeURIComponent(spotId)}` });
  },
  drawRoute() {
    const query = this.createSelectorQuery();
    query.select('#routeCanvas').fields({ node: true, size: true }).exec((result) => {
      const canvasInfo = result[0];
      if (!canvasInfo) return;
      const { node: canvas, width, height } = canvasInfo;
      const context = canvas.getContext('2d');
      const pixelRatio = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2;
      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;
      context.scale(pixelRatio, pixelRatio);
      context.clearRect(0, 0, width, height);
      const points = this.data.routeDisplayPoints;
      if (points.length < 2) return;
      context.beginPath();
      points.forEach((point, index) => {
        const x = width * point.positionX / 100;
        const y = height * point.positionY / 100;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.strokeStyle = 'rgba(128, 42, 34, 0.92)';
      context.lineWidth = 4;
      context.setLineDash([5, 5]);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.stroke();
    });
  },
});
