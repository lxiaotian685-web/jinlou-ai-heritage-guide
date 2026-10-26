const { getDisplayClass } = require('../../utils/display-settings');

const TARGET_ID = 'jinlou-woodcarving';
const PROGRESS_KEY = `arStudyProgress:${TARGET_ID}`;

const HOTSPOTS = [
  { id: 'component', number: 1, title: '观察构件', description: '从梁架、门窗等位置观察木雕构件，比较它们在建筑中的位置与作用。', x: 24, y: 36 },
  { id: 'carving', number: 2, title: '理解雕刻层次', description: '留意纹样由浅到深的起伏变化，观察层次如何让画面更有立体感。', x: 58, y: 48 },
  { id: 'gilding', number: 3, title: '查看饰金效果', description: '观察金色装饰与木质底色的对比，看看视觉重点如何被突出。', x: 72, y: 25 },
];

Page({
  data: {
    displayClass: '',
    stage: 'intro',
    cameraReady: false,
    cameraError: '',
    useFallback: false,
    hotspots: HOTSPOTS.map((item) => ({ ...item, visited: false })),
    activeHotspot: HOTSPOTS[0],
    visitedHotspots: [],
    quizOptions: [
      { id: 'a', text: '雕刻有深有浅，再用饰金突出重点' },
      { id: 'b', text: '把所有纹样都做成一样的颜色' },
      { id: 'c', text: '只要木材够厚，看起来就会立体' },
    ],
    selectedAnswer: '',
    quizPassed: false,
    quizUnlocked: false,
    visitedCount: 0,
    completedBefore: false,
  },
  onShow() {
    this.setData({
      displayClass: getDisplayClass(),
      completedBefore: Boolean(wx.getStorageSync(PROGRESS_KEY)),
    });
  },
  startExperience() {
    this.setData({ stage: 'camera', cameraReady: false, cameraError: '', useFallback: false });
  },
  handleCameraReady() {
    this.setData({ cameraReady: true, cameraError: '' });
  },
  handleCameraError(event) {
    const message = event?.detail?.errMsg || '当前设备无法打开相机';
    this.setData({ cameraReady: false, cameraError: message });
  },
  confirmTarget() {
    this.enterDiscovery(false);
  },
  useImageFallback() {
    this.enterDiscovery(true);
  },
  enterDiscovery(useFallback) {
    const hotspots = HOTSPOTS.map((item, index) => ({ ...item, visited: index === 0 }));
    this.setData({ stage: 'discovered', useFallback, cameraError: '', hotspots, activeHotspot: hotspots[0], visitedHotspots: ['component'], visitedCount: 1, quizUnlocked: false });
  },
  selectHotspot(event) {
    const id = event.currentTarget.dataset.id;
    const activeHotspot = HOTSPOTS.find((item) => item.id === id);
    if (!activeHotspot) return;
    const visitedHotspots = Array.from(new Set([...this.data.visitedHotspots, id]));
    const hotspots = this.data.hotspots.map((item) => ({ ...item, visited: visitedHotspots.includes(item.id) }));
    this.setData({
      hotspots,
      activeHotspot: hotspots.find((item) => item.id === id),
      visitedHotspots,
      visitedCount: visitedHotspots.length,
      quizUnlocked: visitedHotspots.length === HOTSPOTS.length,
    });
  },
  answerQuiz(event) {
    if (!this.data.quizUnlocked) {
      wx.showToast({ title: '请先集齐三枚线索', icon: 'none' });
      return;
    }
    const selectedAnswer = event.currentTarget.dataset.id;
    const quizPassed = selectedAnswer === 'a';
    this.setData({ selectedAnswer, quizPassed });
    if (quizPassed) {
      wx.setStorageSync(PROGRESS_KEY, {
        targetId: TARGET_ID,
        completedAt: Date.now(),
        visitedHotspots: [...this.data.visitedHotspots],
      });
      this.setData({ completedBefore: true });
      wx.vibrateShort({ type: 'light' });
      wx.showToast({ title: '彩蛋已解锁', icon: 'success' });
    }
  },
  openNarration() {
    wx.navigateTo({ url: '/pages/spot-detail/index?id=jinlou' });
  },
  openAssistant() {
    wx.navigateTo({ url: '/pages/assistant/index' });
  },
  resetExperience() {
    const hotspots = HOTSPOTS.map((item) => ({ ...item, visited: false }));
    this.setData({ stage: 'intro', cameraReady: false, cameraError: '', useFallback: false, hotspots, activeHotspot: hotspots[0], visitedHotspots: [], visitedCount: 0, quizUnlocked: false, selectedAnswer: '', quizPassed: false });
  },
});
