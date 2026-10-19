const { getPanorama, getPanoramas } = require('../../services/api');
const { getDisplayClass } = require('../../utils/display-settings');

Page({
  data: {
    scene: null,
    scenes: [],
    loading: true,
    error: '',
    activeHotspot: null,
    showHelp: true,
    displayClass: '',
  },
  onLoad(options) {
    this.sceneId = options.id;
    this.loadViewer();
  },
  onShow() {
    this.setData({ displayClass: getDisplayClass() });
  },
  async loadViewer() {
    if (!this.sceneId) return this.setData({ loading: false, error: '缺少全景场景编号。' });
    this.setData({ loading: true, error: '', activeHotspot: null });
    try {
      const [detail, list] = await Promise.all([getPanorama(this.sceneId), getPanoramas()]);
      this.setData({ scene: detail.data, scenes: list.data, loading: false });
    } catch (_error) {
      this.setData({ loading: false, error: '全景场景加载失败，请稍后重试。' });
    }
  },
  handleHotspot(event) {
    const hotspot = this.data.scene.hotspots.find((item) => item.id === event.currentTarget.dataset.id);
    if (!hotspot) return;
    if (hotspot.type === 'scene' && hotspot.targetPanoramaId) {
      this.switchScene(hotspot.targetPanoramaId);
      return;
    }
    this.setData({ activeHotspot: hotspot, showHelp: false });
  },
  closeHotspot() {
    this.setData({ activeHotspot: null });
  },
  stopPropagation() {},
  selectScene(event) {
    const id = event.currentTarget.dataset.id;
    if (id !== this.sceneId) this.switchScene(id);
  },
  switchScene(id) {
    this.sceneId = id;
    this.setData({ showHelp: false });
    this.loadViewer();
  },
  dismissHelp() {
    this.setData({ showHelp: false });
  },
});
