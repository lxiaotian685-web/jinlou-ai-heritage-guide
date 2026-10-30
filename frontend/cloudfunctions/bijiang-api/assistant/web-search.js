const https = require('node:https');

function postSearch(body, key) {
  return new Promise((resolve, reject) => {
    const req = https.request('https://api.deepseek.com/v1/tools/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        raw += chunk;
        if (raw.length > 1000000) req.destroy(new Error('search_response_too_large'));
      });
      res.on('error', reject);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('search_http_error'));
        try { resolve(JSON.parse(raw)); } catch (_) { reject(new Error('search_invalid_response')); }
      });
    });
    const timer = setTimeout(() => req.destroy(new Error('search_timeout')), 6000);
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject);
    req.end(JSON.stringify(body));
  });
}

function createWebSearch(env = process.env, request = postSearch) {
  const enabled = env.ASSISTANT_WEB_SEARCH_ENABLED !== 'false' && Boolean(env.DEEPSEEK_API_KEY);
  return {
    enabled,
    async search(question) {
      if (!enabled) return [];
      const result = await request({
        query: Array.from(`碧江金楼 ${String(question)}`).slice(0, 128).join(''),
        count: 3, need_content: true,
      }, env.DEEPSEEK_API_KEY);
      if (!Array.isArray(result.results)) throw new Error('search_failed');
      return (result.results || []).flatMap((item, index) => {
        let url;
        try { url = new URL(item.url); } catch (_) { return []; }
        if (url.protocol !== 'https:' || url.username || url.password) return [];
        const content = String(item.content || item.summary || item.snippet || '').slice(0, 2400);
        if (!content.trim()) return [];
        return [{ score: 1, reason: '联网检索', item: {
          id: `web:${index + 1}`, title: String(item.title || url.hostname).slice(0, 160),
          content, category: 'web', sourceUrl: url.href, sourceIds: [],
        } }];
      });
    },
  };
}
module.exports = { createWebSearch };
