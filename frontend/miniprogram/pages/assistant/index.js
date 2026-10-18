const { askAssistant } = require('../../services/api');
const { getDisplayClass } = require('../../utils/display-settings');

Page({
  onShow() { this.setData({ displayClass: getDisplayClass() }); },
  data: {
    sending: false,
    selectedQuestion: '',
    answer: null,
    quickQuestions: ['金楼为什么叫金楼？', '建筑是什么年代？', '这里的木雕看什么？', '有哪些重点看点？', '建议游览多久？', '老人儿童要注意什么？'],
  },
  chooseQuickQuestion(event) {
    const question = event.currentTarget.dataset.question;
    this.loadAnswer(question);
  },
  async loadAnswer(question) {
    if (!question || this.data.sending) return;
    this.setData({ selectedQuestion: question, answer: null, sending: true });
    try {
      const result = await askAssistant(question);
      this.setData({
        answer: {
          text: result.data.answer,
          notice: result.data.notice,
          sourceText: (result.data.sources || []).join('、'),
          publicStatus: result.data.publicStatus === 'not-ready' ? '暂不作为正式发布答案' : '审核通过后可公开',
        },
        sending: false,
      });
    } catch (_error) {
      this.setData({
        answer: { text: '资料加载失败，请检查网络后重试。', isError: true },
        sending: false,
      });
    }
  },
});
