const { adminLogin, adminGetSpots, adminUpdateSpot, clearApiCache, getErrorMessage } = require('../../services/api');
const { getDisplayClass } = require('../../utils/display-settings');

Page({
  onShow() { this.setData({ displayClass: getDisplayClass() }); },
  data: {
    displayClass: '',
    token: '',
    authorized: false,
    spots: [],
    selectedIndex: 0,
    form: { id: '', name: '', category: '', summary: '' },
    loading: false,
    saving: false,
    message: '',
    error: '',
  },
  handleToken(event) { this.setData({ token: event.detail.value }); },
  async login() {
    const token = this.data.token.trim();
    if (!token || this.data.loading) return;
    this.setData({ loading: true, error: '', message: '' });
    try {
      await adminLogin(token);
      const result = await adminGetSpots(token);
      const spots = result.data || [];
      this.setData({ authorized: true, spots, selectedIndex: 0, form: this.toForm(spots[0]), loading: false, message: '云端管理已连接' });
    } catch (error) {
      this.setData({ loading: false, authorized: false, error: getErrorMessage(error, '登录失败，请检查管理口令。') });
    }
  },
  logout() {
    this.setData({ token: '', authorized: false, spots: [], form: { id: '', name: '', category: '', summary: '' }, message: '', error: '' });
  },
  chooseSpot(event) {
    const selectedIndex = Number(event.detail.value) || 0;
    this.setData({ selectedIndex, form: this.toForm(this.data.spots[selectedIndex]), message: '', error: '' });
  },
  handleField(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
  },
  async save() {
    if (!this.data.authorized || !this.data.form.id || this.data.saving) return;
    const data = { name: this.data.form.name, category: this.data.form.category, summary: this.data.form.summary };
    this.setData({ saving: true, error: '', message: '' });
    try {
      const result = await adminUpdateSpot(this.data.token.trim(), this.data.form.id, data);
      const updated = result.data;
      const spots = this.data.spots.map((spot) => spot.id === updated.id ? updated : spot);
      clearApiCache();
      this.setData({ spots, form: this.toForm(updated), saving: false, message: '保存成功，游客端将在一分钟内读取新内容' });
    } catch (error) {
      this.setData({ saving: false, error: getErrorMessage(error, '保存失败，请稍后重试。') });
    }
  },
  toForm(spot) {
    return spot ? { id: spot.id, name: spot.name, category: spot.category, summary: spot.summary } : { id: '', name: '', category: '', summary: '' };
  },
});
