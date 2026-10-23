const { getDisplayClass } = require('../../utils/display-settings');

const TARGET_ID = 'jinlou-woodcarving';
const PROGRESS_KEY = `arStudyProgress:${TARGET_ID}`;

const HOTSPOTS = [
  { id: 'component', number: 1, title: '观察构件', description: '从梁架、门窗等位置辨认木雕构件；具体点位仍待现场标定。', x: 24, y: 36 },
  { id: 'carving', number: 2, title: '理解雕刻层次', description: '用浅浮雕、深浮雕等概念辅助观察，正式术语与实例待专家确认。', x: 58, y: 48 },
  { id: 'gilding', number: 3, title: '查看饰金效果', description: '留意金色装饰与木质底色的层次关系；材料和工序待资料审核。', x: 72, y: 25 },
];

Page({
  data: {
    displayClass: '',
    stage: 'intro',
    cameraReady: false,
    cameraError: '',
    useFallback: false,
    hotspots: HOTSPOTS,
    activeHotspot: HOTSPOTS[0],
    visitedHotspots: [],
    quizOptions: [
      { id: 'a', text: '雕刻有深有浅，再用饰金突出重点' },
      { id: 'b', text: '把所有纹样都做成一样的颜色' },
      { id: 'c', text: '只要木材够厚，看起来就会立体' },
    ],
    selectedAnswer: '',
    quizPassed: false,
    completedBefore: false,
  },
  onShow() {
    this.setData({
      displayClass: getDisplayClass(),
      completedBefore: Boolean(wx.getStorageSync(PROGRESS_KEY)),
    });
  },
  startExperience() {
    this.setData({ stage: 'camera', cameraError: '', useFallback: false });
  },
  handleCameraReady() {
    this.setData({ cameraReady: true, cameraError: '' });
  },
  handleCameraError(event) {
    const message = event?.detail?.errMsg || '当前设备无法打开相机';
    this.setData({ cameraReady: false, cameraError: message });
  },
  confirmTarget() {
    this.setData({ stage: 'discovered', activeHotspot: HOTSPOTS[0], visitedHotspots: ['component'] });
  },
  useImageFallback() {
    this.setData({ stage: 'discovered', useFallback: true, cameraError: '', activeHotspot: HOTSPOTS[0], visitedHotspots: ['component'] });
  },
  selectHotspot(event) {
    const id = event.currentTarget.dataset.id;
    const activeHotspot = HOTSPOTS.find((item) => item.id === id);
    if (!activeHotspot) return;
    const visitedHotspots = Array.from(new Set([...this.data.visitedHotspots, id]));
    this.setData({ activeHotspot, visitedHotspots });
  },
  answerQuiz(event) {
    const selectedAnswer = event.currentTarget.dataset.id;
    const quizPassed = selectedAnswer === 'a';
    this.setData({ selectedAnswer, quizPassed });
    if (quizPassed) {
      wx.setStorageSync(PROGRESS_KEY, { completedAt: Date.now(), visitedHotspots: this.data.visitedHotspots });
      this.setData({ completedBefore: true });
      wx.showToast({ title: '解锁观察员', icon: 'success' });
    }
  },
  openNarration() {
    wx.navigateTo({ url: '/pages/spot-detail/index?id=jinlou' });
  },
  openAssistant() {
    wx.navigateTo({ url: '/pages/assistant/index' });
  },
  resetExperience() {
    this.setData({ stage: 'intro', cameraReady: false, cameraError: '', useFallback: false, activeHotspot: HOTSPOTS[0], visitedHotspots: [], selectedAnswer: '', quizPassed: false });
  },
});
