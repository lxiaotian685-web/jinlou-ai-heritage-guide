const { getFavoriteSpotIds, clearFavoriteSpotIds } = require('../../utils/favorites');
const { getVisitedSpotIds, clearVisitedSpotIds } = require('../../utils/visit-progress');
const { getDisplayClass } = require('../../utils/display-settings');
const { getRecentSpotIds, clearRecentSpots } = require('../../utils/recent-spots');
const { getAllSpotNotes, clearSpotNotes } = require('../../utils/spot-notes');

Page({
  data: { summary: {}, displayClass: '' },
  onShow() { this.refresh(); },
  refresh() {
    this.setData({
      displayClass: getDisplayClass(),
      summary: {
        favorites: getFavoriteSpotIds().length, visited: getVisitedSpotIds().length, recent: getRecentSpotIds().length,
        route: Boolean(wx.getStorageSync('selectedTourRoute')), display: Boolean(wx.getStorageSync('displaySettings')),
        notes: Object.keys(getAllSpotNotes()).length, playbackRate: Number(wx.getStorageSync('narrationPlaybackRate')) || 1,
      },
    });
  },
  clearCategory(event) {
    const type = event.currentTarget.dataset.type;
    const actions = {
      visit: ['清除收藏、游览进度、最近浏览和当前路线？', () => { clearFavoriteSpotIds(); clearVisitedSpotIds(); clearRecentSpots(); wx.removeStorageSync('selectedTourRoute'); }],
      notes: ['清除全部景点评分和私人笔记？', clearSpotNotes],
      display: ['恢复标准显示及讲解速度？', () => { wx.removeStorageSync('displaySettings'); wx.removeStorageSync('narrationPlaybackRate'); }],
    };
    const selected = actions[type];
    if (!selected) return;
    wx.showModal({ title: selected[0], content: '此操作只影响当前手机，且无法撤销。', confirmColor: '#a6402d', success: ({ confirm }) => {
      if (!confirm) return; selected[1](); this.refresh(); wx.showToast({ title: '已清除', icon: 'none' });
    } });
  },
  openAdmin() { wx.navigateTo({ url: '/pages/admin/index' }); },
});
