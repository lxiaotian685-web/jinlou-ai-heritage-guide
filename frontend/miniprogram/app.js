const config = require('./config');
const { checkCloudConnection } = require('./services/cloud');

App({
  onLaunch() {
    if (!wx.cloud) {
      console.warn('当前基础库不支持微信云开发');
      return;
    }
    wx.cloud.init({
      env: config.cloudEnvId,
      traceUser: true,
    });
    this.globalData.cloudReady = true;
  },

  checkCloudConnection,

  globalData: {
    apiBaseUrl: config.apiBaseUrl,
    cloudEnvId: config.cloudEnvId,
    cloudReady: false,
  },
});
