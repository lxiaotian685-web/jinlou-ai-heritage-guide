const STORAGE_KEY = 'spotNotes';

function getAllSpotNotes() {
  const value = wx.getStorageSync(STORAGE_KEY);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getSpotNote(spotId) {
  const value = getAllSpotNotes()[spotId];
  return value && typeof value === 'object'
    ? { rating: Number(value.rating) || 0, text: String(value.text || ''), updatedAt: String(value.updatedAt || '') }
    : { rating: 0, text: '', updatedAt: '' };
}

function saveSpotNote(spotId, note) {
  const rating = Math.min(5, Math.max(0, Number(note.rating) || 0));
  const text = String(note.text || '').trim().slice(0, 500);
  const notes = getAllSpotNotes();
  if (!rating && !text) delete notes[spotId];
  else notes[spotId] = { rating, text, updatedAt: new Date().toISOString() };
  wx.setStorageSync(STORAGE_KEY, notes);
  return getSpotNote(spotId);
}

function removeSpotNote(spotId) {
  const notes = getAllSpotNotes();
  delete notes[spotId];
  wx.setStorageSync(STORAGE_KEY, notes);
}

function clearSpotNotes() { wx.removeStorageSync(STORAGE_KEY); }

module.exports = { getAllSpotNotes, getSpotNote, saveSpotNote, removeSpotNote, clearSpotNotes };
