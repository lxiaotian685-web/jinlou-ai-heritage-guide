const { submitFeedback, getErrorMessage } = require('../../services/api');
const { getDisplayClass } = require('../../utils/display-settings');

const SOURCE_VERSION = '1.7.0';
const MAX_CONTENT = 500;
const MAX_CONTACT = 80;

const CATEGORIES = [
  { key: 'content-error', index: '01', label: '内容纠错', hint: '文字、图片或讲解有误' },
  { key: 'feature-issue', index: '02', label: '功能问题', hint: '页面打不开、播放或定位异常' },
  { key: 'visit-suggestion', index: '03', label: '参观建议', hint: '展览、路线与服务建议' },
  { key: 'other', index: '04', label: '其他', hint: '其他想告诉我们的事' },
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pickRecord(result) {
  if (!result) return {};
  if (result.record) return result.record;
  if (result.data) return result.data.record || result.data;
  return result;
}

Page({
  data: {
    displayClass: '',
    categories: CATEGORIES,
    category: CATEGORIES[0].key,
    content: '',
    contentCount: 0,
    contact: '',
    contactCount: 0,
    errorMessage: '',
    submitting: false,
    submitted: false,
    submittedCategoryLabel: '',
    referenceId: '',
    submittedAtText: '',
  },
  onShow() {
    this.setData({ displayClass: getDisplayClass() });
  },
  selectCategory(event) {
    if (this.data.submitting) return;
    const key = event.currentTarget.dataset.key;
    const selected = CATEGORIES.filter((item) => item.key === key)[0];
    if (!selected) return;
    this.setData({ category: key, errorMessage: '' });
  },
  onContentInput(event) {
    const content = event.detail.value || '';
    this.setData({ content, contentCount: content.length, errorMessage: '' });
  },
  onContactInput(event) {
    const contact = event.detail.value || '';
    this.setData({ contact, contactCount: contact.length, errorMessage: '' });
  },
  async handleSubmit() {
    if (this.data.submitting) return;
    const content = this.data.content.trim();
    const contact = this.data.contact.trim();
    if (!content) {
      this.setData({ errorMessage: '请填写反馈内容' });
      return;
    }
    if (content.length > MAX_CONTENT) {
      this.setData({ errorMessage: '反馈内容不能超过500个字符' });
      return;
    }
    if (contact.length > MAX_CONTACT) {
      this.setData({ errorMessage: '联系方式不能超过80个字符' });
      return;
    }
    const category = CATEGORIES.filter((item) => item.key === this.data.category)[0] || CATEGORIES[0];
    this.setData({ submitting: true, errorMessage: '' });
    try {
      const result = await submitFeedback({
        category: category.key,
        content,
        contact,
        sourceVersion: SOURCE_VERSION,
      });
      const record = pickRecord(result);
      const createdAt = record.createdAt || record.created_at || '';
      this.setData({
        submitting: false,
        submitted: true,
        referenceId: record.id || '',
        submittedAtText: formatDateTime(createdAt),
        submittedCategoryLabel: category.label,
      });
      wx.pageScrollTo({ scrollTop: 0, duration: 200 });
    } catch (error) {
      this.setData({
        submitting: false,
        errorMessage: getErrorMessage(error, '提交失败，请检查网络后重试。'),
      });
    }
  },
  resetForm() {
    this.setData({
      submitted: false,
      content: '',
      contentCount: 0,
      contact: '',
      contactCount: 0,
      errorMessage: '',
      submitting: false,
      referenceId: '',
      submittedAtText: '',
      submittedCategoryLabel: '',
    });
  },
  goService() {
    wx.switchTab({
      url: '/pages/service/index',
      fail: () => {
        wx.navigateBack({ delta: 1 });
      },
    });
  },
});
