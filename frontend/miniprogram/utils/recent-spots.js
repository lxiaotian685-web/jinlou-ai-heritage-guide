const STORAGE_KEY = 'recentSpotIds';

function getRecentSpotIds() {
  const value = wx.getStorageSync(STORAGE_KEY);
  return Array.isArray(value) ? value.filter((id) => typeof id === 'string' && id) : [];
}

function recordRecentSpot(spotId) {
  const next = [spotId, ...getRecentSpotIds().filter((id) => id !== spotId)].slice(0, 10);
  wx.setStorageSync(STORAGE_KEY, next);
  return next;
}

function clearRecentSpots() { wx.removeStorageSync(STORAGE_KEY); }

module.exports = { getRecentSpotIds, recordRecentSpot, clearRecentSpots };
