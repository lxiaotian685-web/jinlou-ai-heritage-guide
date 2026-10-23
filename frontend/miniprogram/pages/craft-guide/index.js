const { getCraftGuide } = require('../../services/api');
const { getDisplayClass } = require('../../utils/display-settings');

Page({
  data: { guide: null, activeStep: 0, loading: true, error: '', displayClass: '' },
  onLoad(options) {
    this.spotId = options.id;
    this.loadGuide();
  },
  onShow() {
    this.setData({ displayClass: getDisplayClass() });
  },
  async loadGuide() {
    if (!this.spotId) return this.setData({ loading: false, error: '缺少景点编号。' });
    this.setData({ loading: true, error: '' });
    try {
      const result = await getCraftGuide(this.spotId);
      this.setData({ guide: result.data, activeStep: 0, loading: false });
    } catch (_error) {
      this.setData({ loading: false, error: '暂时无法读取工艺图解。' });
    }
  },
  selectStep(event) {
    this.setData({ activeStep: Number(event.currentTarget.dataset.index) });
  },
  handleModel() {
    wx.showToast({ title: '真实3D模型待制作', icon: 'none' });
  },
});
