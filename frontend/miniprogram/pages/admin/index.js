const {
  adminLogin,
  adminGetSpots,
  adminUpdateSpot,
  adminGetFeedback,
  adminUpdateFeedback,
  clearApiCache,
  getErrorMessage,
} = require('../../services/api');
const { getDisplayClass } = require('../../utils/display-settings');

const FEEDBACK_CATEGORY_LABELS = {
  'content-error': '内容纠错',
  'feature-issue': '功能问题',
  'visit-suggestion': '参观建议',
  other: '其他',
};

const FEEDBACK_STATUS_LABELS = {
  pending: '待处理',
  processing: '处理中',
  done: '已完成',
};

const FEEDBACK_STATUS_OPTIONS = Object.keys(FEEDBACK_STATUS_LABELS).map((key) => ({
  key,
  label: FEEDBACK_STATUS_LABELS[key],
}));

const FEEDBACK_FILTER_OPTIONS = [{ key: 'all', label: '全部' }].concat(FEEDBACK_STATUS_OPTIONS);

function padNumber(value) {
  return String(value).padStart(2, '0');
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())} ${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
}

Page({
  onShow() { this.setData({ displayClass: getDisplayClass() }); },
  data: {
    displayClass: '',
    token: '',
    authorized: false,
    activeTab: 'spots',
    spots: [],
    selectedIndex: 0,
    form: { id: '', name: '', category: '', summary: '' },
    loading: false,
    saving: false,
    message: '',
    error: '',
    feedback: [],
    feedbackLoading: false,
    feedbackStatus: 'all',
    feedbackStatuses: FEEDBACK_FILTER_OPTIONS,
    feedbackStatusOptions: FEEDBACK_STATUS_OPTIONS,
    feedbackSavingId: '',
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
      return;
    }
    const feedbackLoaded = await this.loadFeedback({ silent: true });
    if (!feedbackLoaded) this.setData({ message: '云端管理已连接，反馈列表暂未读取' });
  },
  logout() {
    this.setData({
      token: '',
      authorized: false,
      activeTab: 'spots',
      spots: [],
      form: { id: '', name: '', category: '', summary: '' },
      message: '',
      error: '',
      feedback: [],
      feedbackLoading: false,
      feedbackStatus: 'all',
      feedbackSavingId: '',
    });
  },
  switchTab(event) {
    const tab = event.currentTarget.dataset.tab;
    if (tab !== 'spots' && tab !== 'feedback') return;
    if (this.data.activeTab === tab) return;
    this.setData({ activeTab: tab });
    if (tab === 'feedback' && !this.data.feedback.length && !this.data.feedbackLoading) this.loadFeedback();
  },
  filterFeedback(event) {
    const status = event.currentTarget.dataset.status;
    const valid = this.data.feedbackStatuses.some((entry) => entry.key === status);
    if (!valid || this.data.feedbackLoading) return;
    if (status === this.data.feedbackStatus && this.data.feedback.length) return;
    this.setData({ feedbackStatus: status, feedback: [], error: '', message: '' });
    this.loadFeedback();
  },
  async loadFeedback(options = {}) {
    if (!this.data.authorized || this.data.feedbackLoading) return false;
    const token = this.data.token.trim();
    if (!token) return false;
    this.setData({ feedbackLoading: true, error: '' });
    try {
      const status = this.data.feedbackStatus === 'all' ? '' : this.data.feedbackStatus;
      const result = await adminGetFeedback(token, status);
      if (!this.data.authorized || this.data.token.trim() !== token) {
        this.setData({ feedbackLoading: false });
        return false;
      }
      const feedback = (result.data || []).map((item) => this.decorateFeedback(item));
      this.setData({ feedback, feedbackLoading: false });
      return true;
    } catch (error) {
      if (options.silent) {
        this.setData({ feedbackLoading: false });
      } else {
        this.setData({ feedbackLoading: false, error: getErrorMessage(error, '反馈列表读取失败，请稍后重试。') });
      }
      return false;
    }
  },
  handleFeedbackNote(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= this.data.feedback.length) return;
    this.setData({ [`feedback[${index}].adminNote`]: event.detail.value });
  },
  setFeedbackStatus(event) {
    const index = Number(event.currentTarget.dataset.index);
    const status = event.currentTarget.dataset.status;
    if (!this.data.feedback[index] || !FEEDBACK_STATUS_LABELS[status]) return;
    this.setData({
      [`feedback[${index}].status`]: status,
      [`feedback[${index}].statusLabel`]: FEEDBACK_STATUS_LABELS[status],
    });
  },
  async saveFeedback(event) {
    const index = Number(event.currentTarget.dataset.index);
    const item = this.data.feedback[index];
    if (!this.data.authorized || !item || !item.id || this.data.feedbackSavingId) return;
    this.setData({ feedbackSavingId: item.id, error: '', message: '' });
    try {
      const result = await adminUpdateFeedback(this.data.token.trim(), item.id, {
        status: item.status,
        adminNote: item.adminNote,
      });
      const updated = this.decorateFeedback(result.data || item);
      const feedback = this.data.feedback.map((entry) => (entry.id === updated.id ? updated : entry));
      this.setData({ feedback, feedbackSavingId: '', message: '反馈已更新' });
    } catch (error) {
      this.setData({ feedbackSavingId: '', error: getErrorMessage(error, '反馈保存失败，请稍后重试。') });
    }
  },
  decorateFeedback(feedback) {
    const item = feedback || {};
    const status = FEEDBACK_STATUS_LABELS[item.status] ? item.status : 'pending';
    return {
      ...item,
      status,
      adminNote: item.adminNote || '',
      categoryLabel: FEEDBACK_CATEGORY_LABELS[item.category] || '其他',
      statusLabel: FEEDBACK_STATUS_LABELS[status],
      createdAtText: formatDateTime(item.createdAt),
    };
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
