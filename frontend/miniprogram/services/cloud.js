function checkCloudConnection() {
  if (!wx.cloud) {
    return Promise.reject(new Error('当前基础库不支持微信云开发'));
  }

  return wx.cloud.callFunction({ name: 'bijiang-cloud-check' })
    .then((response) => response.result);
}

module.exports = {
  checkCloudConnection,
};
