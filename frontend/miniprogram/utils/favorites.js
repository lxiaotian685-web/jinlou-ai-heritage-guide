const STORAGE_KEY = 'favoriteSpotIds';

function getFavoriteSpotIds() {
  const value = wx.getStorageSync(STORAGE_KEY);
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id) => typeof id === 'string' && id))];
}

function isFavoriteSpot(spotId) {
  return getFavoriteSpotIds().includes(spotId);
}

function toggleFavoriteSpot(spotId) {
  const currentIds = getFavoriteSpotIds();
  const isFavorite = !currentIds.includes(spotId);
  const favoriteIds = isFavorite
    ? [...currentIds, spotId]
    : currentIds.filter((id) => id !== spotId);
  wx.setStorageSync(STORAGE_KEY, favoriteIds);
  return { favoriteIds, isFavorite };
}

function clearFavoriteSpotIds() {
  wx.removeStorageSync(STORAGE_KEY);
}

module.exports = { getFavoriteSpotIds, isFavoriteSpot, toggleFavoriteSpot, clearFavoriteSpotIds };
