const CACHE_PREFIX = 'apiCache:';
const { applyBundledCover } = require('../utils/spot-images');

function getErrorMessage(error, fallback = '请求失败，请稍后重试。') {
  const message = error?.userMessage || error?.message || error?.errMsg || '';
  if (/timeout|超时/i.test(message)) return '请求超时，请检查网络后重试。';
  if (/request:fail|network|网络|服务器|ECONNREFUSED/i.test(message)) return '无法连接服务器，请检查网络和后端服务。';
  return message || fallback;
}

function formatCacheTime(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addCacheState(data, fromCache, savedAt) {
  return {
    ...data,
    _cache: {
      fromCache,
      savedAt,
      notice: fromCache ? `网络不可用，正在显示 ${formatCacheTime(savedAt)} 保存的数据。` : '',
    },
  };
}

function readCache(path) {
  try {
    const cached = wx.getStorageSync(`${CACHE_PREFIX}${path}`);
    return cached?.savedAt && cached?.data ? cached : null;
  } catch (_error) {
    return null;
  }
}

function saveCache(path, data) {
  const savedAt = Date.now();
  try {
    wx.setStorageSync(`${CACHE_PREFIX}${path}`, { savedAt, data });
  } catch (error) {
    console.warn('API cache write failed', { path, error });
  }
  return savedAt;
}

function getApiCacheKeys() {
  try { return wx.getStorageInfoSync().keys.filter((key) => key.startsWith(CACHE_PREFIX)); }
  catch (_error) { return []; }
}

function clearApiCache() {
  for (const key of getApiCacheKeys()) wx.removeStorageSync(key);
}

function requestLocal(path, options, cached) {
  const { apiBaseUrl } = getApp().globalData;
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${apiBaseUrl}${path}`,
      method: options.method || 'GET',
      data: options.data,
      header: { ...(options.data ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) },
      timeout: cached ? 1500 : 8000,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          return resolve(response.data);
        }
        const requestError = new Error(response.data?.error?.message || '服务器返回异常');
        requestError.userMessage = response.data?.error?.message || `服务器响应异常（${response.statusCode}）`;
        return reject(requestError);
      },
      fail(error) {
        console.warn('Local API request failed', { url: `${apiBaseUrl}${path}`, error });
        return reject(error);
      },
    });
  });
}

async function requestCloud(path, options) {
  const result = await wx.cloud.callFunction({
    name: 'bijiang-api',
    data: { path, method: options.method || 'GET', body: options.data || null, adminToken: options.adminToken || '' },
  });
  if (result.result?.ok) return result.result.response;
  const cloudError = new Error(result.result?.error?.message || '云端接口返回异常');
  cloudError.userMessage = result.result?.error?.message || '云端接口返回异常';
  throw cloudError;
}

async function requestAdmin(path, options = {}) {
  if (!getApp().globalData.cloudReady) {
    const cloudError = new Error('云开发尚未连接，请检查网络后重试。');
    cloudError.userMessage = cloudError.message;
    throw cloudError;
  }
  return requestCloud(path, options);
}

async function request(path, options = {}) {
  const cached = options.cache ? readCache(path) : null;
  let lastError;
  if (getApp().globalData.cloudReady) {
    try {
      const data = await requestCloud(path, options);
      if (!options.cache) return data;
      const savedAt = saveCache(path, data);
      return addCacheState(data, false, savedAt);
    } catch (error) {
      lastError = error;
      console.warn('Cloud API request failed, trying local fallback', { path, error });
    }
  }
  try {
    const data = await requestLocal(path, options, cached);
    if (!options.cache) return data;
    const savedAt = saveCache(path, data);
    return addCacheState(data, false, savedAt);
  } catch (error) {
    lastError = error;
  }
  if (cached) return addCacheState(cached.data, true, cached.savedAt);
  lastError.userMessage = getErrorMessage(lastError);
  throw lastError;
}

module.exports = {
  getErrorMessage,
  getApiCacheKeys,
  clearApiCache,
  getSpots: () => request('/spots', { cache: true }).then((result) => ({ ...result, data: (result.data || []).map(applyBundledCover) })),
  getSpot: (id) => request(`/spots/${encodeURIComponent(id)}`, { cache: true }).then((result) => ({ ...result, data: applyBundledCover(result.data) })),
  getNarrations: (id) => request(`/spots/${encodeURIComponent(id)}/narrations`, { cache: true }),
  getCraftGuide: (id) => request(`/spots/${encodeURIComponent(id)}/craft-guide`),
  getPanoramas: () => request('/panoramas'),
  getPanorama: (id) => request(`/panoramas/${encodeURIComponent(id)}`),
  getService: () => request('/service'),
  getHome: () => request('/home', { cache: true }),
  getRecommendations: (category) => request(`/recommendations?category=${encodeURIComponent(category)}`),
  trackRecommendation: (itemId, action) => request('/recommendations/track', { method: 'POST', data: { itemId, action } }),
  getAssistantSuggestions: () => request('/assistant/suggestions', { cache: true }),
  askAssistant: (question) => request('/assistant/chat', { method: 'POST', data: { question } }),
  getTourRoutes: () => request('/routes', { cache: true }),
  getSiteMap: () => request('/site-map', { cache: true }),
  adminLogin: (adminToken) => requestAdmin('/admin/session', { method: 'POST', adminToken }),
  adminGetSpots: (adminToken) => requestAdmin('/admin/spots', { adminToken }),
  adminUpdateSpot: (adminToken, id, data) => requestAdmin(`/admin/spots/${encodeURIComponent(id)}`, { method: 'PATCH', adminToken, data }),
};
