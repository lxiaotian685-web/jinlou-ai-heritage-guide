const STORAGE_KEY = 'visitedSpotIds';

function getVisitedSpotIds() {
  const value = wx.getStorageSync(STORAGE_KEY);
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id) => typeof id === 'string' && id))];
}

function isVisitedSpot(spotId) {
  return getVisitedSpotIds().includes(spotId);
}

function toggleVisitedSpot(spotId) {
  const currentIds = getVisitedSpotIds();
  const isVisited = !currentIds.includes(spotId);
  const visitedSpotIds = isVisited
    ? [...currentIds, spotId]
    : currentIds.filter((id) => id !== spotId);
  wx.setStorageSync(STORAGE_KEY, visitedSpotIds);
  return { visitedSpotIds, isVisited };
}

function clearVisitedSpotIds() {
  wx.removeStorageSync(STORAGE_KEY);
}

module.exports = { getVisitedSpotIds, isVisitedSpot, toggleVisitedSpot, clearVisitedSpotIds };
