const { getNarrations, getSpot, getSpots, getErrorMessage } = require('../../services/api');
const { isFavoriteSpot, toggleFavoriteSpot } = require('../../utils/favorites');
const { isVisitedSpot, toggleVisitedSpot } = require('../../utils/visit-progress');
const { getDisplayClass } = require('../../utils/display-settings');
const { recordRecentSpot } = require('../../utils/recent-spots');
const { getSpotNote, saveSpotNote, removeSpotNote } = require('../../utils/spot-notes');

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5];
const CLOUD_AUDIO_ROOT = 'cloud://cloud1-d8gmw1jur6dc98110.636c-cloud1-d8gmw1jur6dc98110-1470332055/bijiang-heritage/audio';
const createCloudAudio = (spotId) => ({
  fileID: `${CLOUD_AUDIO_ROOT}/${spotId}-zh.wav`,
  cacheKey: `cloudAudioCache:${spotId}:zh-CN`,
});
const CLOUD_AUDIO_SPOT_IDS = [
  'nanshan-hall', 'zhifangdi', 'duizhao', 'jinlou', 'shouqingwu',
  'boshao-clinic', 'nilou', 'wokear-residence', 'wokear-house', 'yiyu-school',
  'components-exhibit', 'twenty-four-odes', 'baoyue-pavilion', 'diequ-pavilion', 'garden',
];
const CLOUD_AUDIO = {};
for (const spotId of CLOUD_AUDIO_SPOT_IDS) CLOUD_AUDIO[`${spotId}:zh-CN`] = createCloudAudio(spotId);

Page({
  data: { spot: null, narrations: [], activeNarration: null, isFavorite: false, isVisited: false, isPlaying: false, audioProgress: 0, audioTime: '00:00 / 00:00', audioStatus: '', audioError: '', playbackRates: PLAYBACK_RATES, playbackRate: 1, ratingOptions: [1, 2, 3, 4, 5], spotNote: { rating: 0, text: '' }, offlineNotice: '', loading: true, error: '' },
  onLoad(options) {
    this.spotId = options.id || (options.scene ? decodeURIComponent(options.scene) : '');
    this.loadSpot();
  },
  onShareAppMessage() {
    if (!this.data.spot) return { title: '碧江金楼智慧导览', path: '/pages/index/index' };
    return { title: `碧江金楼 · ${this.data.spot.name}`, path: `/pages/spot-detail/index?id=${encodeURIComponent(this.spotId)}` };
  },
  onShareTimeline() {
    return { title: this.data.spot ? `碧江金楼 · ${this.data.spot.name}` : '碧江金楼智慧导览', query: `id=${encodeURIComponent(this.spotId || '')}` };
  },
  onShow() {
    if (this.spotId) this.setData({
      displayClass: getDisplayClass(),
      isFavorite: isFavoriteSpot(this.spotId),
      isVisited: isVisitedSpot(this.spotId),
      spotNote: getSpotNote(this.spotId),
      playbackRate: Number(wx.getStorageSync('narrationPlaybackRate')) || 1,
    });
  },
  onUnload() {
    this.destroyAudio();
  },
  async loadSpot() {
    if (!this.spotId) return this.setData({ loading: false, error: '缺少景点编号。' });
    this.setData({ loading: true, error: '', offlineNotice: '' });
    try {
      const [spotResult, narrationResult, spotsResult] = await Promise.all([getSpot(this.spotId), getNarrations(this.spotId), getSpots()]);
      const currentIndex = spotsResult.data.findIndex((item) => item.id === this.spotId);
      this.setData({
        spot: spotResult.data,
        narrations: narrationResult.data,
        activeNarration: narrationResult.data[0] || null,
        previousSpot: currentIndex > 0 ? spotsResult.data[currentIndex - 1] : null,
        nextSpot: currentIndex >= 0 && currentIndex < spotsResult.data.length - 1 ? spotsResult.data[currentIndex + 1] : null,
        offlineNotice: spotResult._cache?.notice || narrationResult._cache?.notice || '',
        loading: false,
      });
      recordRecentSpot(this.spotId);
    } catch (error) {
      this.setData({ loading: false, error: getErrorMessage(error, '景点不存在或暂时无法读取，可返回景点列表重新选择。') });
    }
  },
  openAdjacentSpot(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.redirectTo({ url: `/pages/spot-detail/index?id=${encodeURIComponent(id)}` });
  },
  switchLanguage(event) {
    const activeNarration = this.data.narrations.find((item) => item.languageCode === event.currentTarget.dataset.code);
    if (activeNarration) {
      this.destroyAudio();
      this.setData({ activeNarration, isPlaying: false, audioProgress: 0, audioTime: '00:00 / 00:00', audioStatus: '', audioError: '' });
    }
  },
  async handleAudio() {
    if (!this.data.activeNarration?.audioReady) {
      this.setData({ audioStatus: '', audioError: '暂无可播放音频，请直接阅读下方讲解文字稿。' });
      return;
    }
    if (this.audio) {
      if (this.data.isPlaying) this.audio.pause();
      else this.audio.play();
      return;
    }
    if (this.audioLoading) return;
    this.audioLoading = true;
    this.setData({ audioStatus: '正在准备普通话试听…', audioError: '' });
    try {
      const source = await this.resolveAudioSource();
      this.createAudio(source.url, source.canFallback);
      this.audio.play();
    } catch (error) {
      console.error('Audio source resolution failed', error);
      this.setData({ audioStatus: '', audioError: '音频暂时无法播放，请直接阅读下方讲解文字稿。' });
    } finally {
      this.audioLoading = false;
    }
  },
  async resolveAudioSource() {
    const configuredCloudUrl = this.data.activeNarration.audioUrl || '';
    const cloudAudio = configuredCloudUrl.startsWith('cloud://')
      ? { fileID: configuredCloudUrl, cacheKey: `cloudAudioCache:${configuredCloudUrl}` }
      : CLOUD_AUDIO[`${this.spotId}:${this.data.activeNarration.languageCode}`];
    if (!cloudAudio || !getApp().globalData.cloudReady) return { url: this.getLocalAudioUrl(), canFallback: false };

    const cachedPath = wx.getStorageSync(cloudAudio.cacheKey);
    if (cachedPath && await this.canAccessFile(cachedPath)) return { url: cachedPath, canFallback: true };
    if (cachedPath) wx.removeStorageSync(cloudAudio.cacheKey);

    try {
      const download = await wx.cloud.downloadFile({ fileID: cloudAudio.fileID });
      if (!download.tempFilePath) throw new Error('云音频未返回临时文件');
      try {
        const saved = await wx.saveFile({ tempFilePath: download.tempFilePath });
        wx.setStorageSync(cloudAudio.cacheKey, saved.savedFilePath);
        return { url: saved.savedFilePath, canFallback: true };
      } catch (saveError) {
        console.warn('Cloud audio cache failed, using temporary file', saveError);
        return { url: download.tempFilePath, canFallback: true };
      }
    } catch (error) {
      console.warn('Cloud audio download failed, using local API fallback', error);
      this.setData({ audioStatus: '云端音频不可用，正在尝试本地试听。', audioError: '' });
      return { url: this.getLocalAudioUrl(), canFallback: false };
    }
  },
  canAccessFile(filePath) {
    return new Promise((resolve) => {
      wx.getFileSystemManager().access({ path: filePath, success: () => resolve(true), fail: () => resolve(false) });
    });
  },
  getLocalAudioUrl() {
    const { apiBaseUrl } = getApp().globalData;
    const audioUrl = this.data.activeNarration.audioUrl;
    return /^https?:\/\//.test(audioUrl) ? audioUrl : `${apiBaseUrl.replace(/\/api\/v1$/, '')}${audioUrl}`;
  },
  createAudio(sourceUrl, canFallback = false) {
    this.audio = wx.createInnerAudioContext();
    this.audio.src = sourceUrl;
    this.audio.playbackRate = this.data.playbackRate;
    this.audio.onPlay(() => this.setData({ isPlaying: true, audioStatus: '正在播放普通话试听。', audioError: '' }));
    this.audio.onPause(() => this.setData({ isPlaying: false, audioStatus: '讲解已暂停。' }));
    this.audio.onStop(() => this.setData({ isPlaying: false, audioStatus: '' }));
    this.audio.onEnded(() => this.setData({ isPlaying: false, audioProgress: 100, audioStatus: '普通话试听已播放完毕。' }));
    this.audio.onTimeUpdate(() => {
      const duration = this.audio.duration || 0;
      const current = this.audio.currentTime || 0;
      this.setData({
        audioProgress: duration ? Math.round((current / duration) * 100) : 0,
        audioTime: `${this.formatTime(current)} / ${this.formatTime(duration)}`,
      });
    });
    this.audio.onError(() => {
      this.setData({ isPlaying: false });
      this.destroyAudio();
      if (canFallback) {
        this.setData({ audioStatus: '云端音频播放失败，正在切换本地试听。', audioError: '' });
        this.createAudio(this.getLocalAudioUrl(), false);
        this.audio.play();
        return;
      }
      this.setData({ audioStatus: '', audioError: '音频加载失败，请检查网络，或直接阅读下方讲解文字稿。' });
    });
  },
  seekAudio(event) {
    if (!this.audio || !this.audio.duration) return wx.showToast({ title: '请先播放讲解', icon: 'none' });
    const target = Math.min(this.audio.duration, Math.max(0, this.audio.currentTime + Number(event.currentTarget.dataset.seconds)));
    this.audio.seek(target);
  },
  setPlaybackRate(event) {
    const playbackRate = Number(event.currentTarget.dataset.rate);
    if (!PLAYBACK_RATES.includes(playbackRate)) return;
    wx.setStorageSync('narrationPlaybackRate', playbackRate);
    if (this.audio) this.audio.playbackRate = playbackRate;
    this.setData({ playbackRate });
  },
  destroyAudio() {
    if (!this.audio) return;
    this.audio.destroy();
    this.audio = null;
  },
  formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
  },
  toggleFavorite() {
    const result = toggleFavoriteSpot(this.spotId);
    this.setData({ isFavorite: result.isFavorite });
    wx.showToast({ title: result.isFavorite ? '已加入游览清单' : '已取消收藏', icon: 'none' });
  },
  toggleVisited() {
    const result = toggleVisitedSpot(this.spotId);
    this.setData({ isVisited: result.isVisited });
    wx.showToast({ title: result.isVisited ? '已记录为游览过' : '已取消游览记录', icon: 'none' });
  },
  selectRating(event) {
    this.setData({ 'spotNote.rating': Number(event.currentTarget.dataset.rating) });
  },
  handleNoteInput(event) {
    this.setData({ 'spotNote.text': event.detail.value });
  },
  savePersonalNote() {
    const spotNote = saveSpotNote(this.spotId, this.data.spotNote);
    this.setData({ spotNote });
    wx.showToast({ title: spotNote.rating || spotNote.text ? '私人记录已保存' : '空记录未保存', icon: 'none' });
  },
  clearPersonalNote() {
    wx.showModal({ title: '清除这条私人记录？', content: '评分和笔记只保存在当前手机，清除后无法恢复。', confirmColor: '#9a4d3f', success: ({ confirm }) => {
      if (!confirm) return;
      removeSpotNote(this.spotId);
      this.setData({ spotNote: { rating: 0, text: '', updatedAt: '' } });
    } });
  },
  openCraftGuide() {
    wx.navigateTo({ url: `/pages/craft-guide/index?id=${encodeURIComponent(this.spotId)}` });
  },
});
