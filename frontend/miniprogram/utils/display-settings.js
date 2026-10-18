const STORAGE_KEY = 'displaySettings';
const allowedSizes = new Set(['normal', 'large']);

function getDisplaySettings() {
  const stored = wx.getStorageSync(STORAGE_KEY) || {};
  const fontSize = stored.fontSize === 'xlarge' ? 'large' : stored.fontSize;
  return { fontSize: allowedSizes.has(fontSize) ? fontSize : 'normal', highContrast: stored.highContrast === true };
}

function saveDisplaySettings(settings) {
  const next = { ...getDisplaySettings(), ...settings };
  wx.setStorageSync(STORAGE_KEY, next);
  return next;
}

function getDisplayClass() {
  const settings = getDisplaySettings();
  return `${settings.fontSize === 'normal' ? '' : `font-${settings.fontSize}`} ${settings.highContrast ? 'high-contrast' : ''}`.trim();
}

module.exports = { getDisplaySettings, saveDisplaySettings, getDisplayClass };
