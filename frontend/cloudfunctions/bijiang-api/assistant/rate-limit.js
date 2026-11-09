function createRateLimiter({ perMinute = 60, perDay = 300, now = Date.now } = {}) {
  const clients = new Map();

  function prune(timestamp) {
    if (clients.size < 500) return;
    for (const [key, entry] of clients) {
      if (timestamp - entry.dayStart >= 86400000) clients.delete(key);
    }
  }

  return {
    check(clientKey = 'anonymous') {
      const timestamp = now();
      const entry = clients.get(clientKey) || { minuteStart: timestamp, minuteCount: 0, dayStart: timestamp, dayCount: 0 };
      if (timestamp - entry.minuteStart >= 60000) {
        entry.minuteStart = timestamp;
        entry.minuteCount = 0;
      }
      if (timestamp - entry.dayStart >= 86400000) {
        entry.dayStart = timestamp;
        entry.dayCount = 0;
      }
      if (entry.minuteCount >= perMinute) return { allowed: false, reason: 'minute' };
      if (entry.dayCount >= perDay) return { allowed: false, reason: 'day' };
      entry.minuteCount += 1;
      entry.dayCount += 1;
      clients.set(clientKey, entry);
      prune(timestamp);
      return { allowed: true };
    },
  };
}

module.exports = { createRateLimiter };
