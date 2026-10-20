import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviewedFaqs } from '../src/reviewed-faqs.js';
import { buildVerifiedCloudAudioMap } from '../src/cloud-audio-assets.js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const backendDirectory = resolve(scriptDirectory, '..');
const outputPath = resolve(backendDirectory, '../frontend/cloudfunctions/bijiang-api/data.json');
const cloudAudioReportPath = resolve(backendDirectory, '../docs/cloud-audio-verification.json');
const apiBaseUrl = process.env.BIJIANG_EXPORT_API || 'http://127.0.0.1:3000/api/v1';

async function get(path) {
  const response = await fetch(`${apiBaseUrl}${path}`);
  if (!response.ok) throw new Error(`读取 ${path} 失败：HTTP ${response.status}`);
  return response.json();
}

const spots = await get('/spots');
const panoramas = await get('/panoramas');
const spotDetails = {};
const narrations = {};
const craftGuides = {};
const panoramaDetails = {};
let verifiedCloudAudio = new Map();
try {
  const report = JSON.parse(await readFile(cloudAudioReportPath, 'utf8'));
  verifiedCloudAudio = buildVerifiedCloudAudioMap(report);
} catch (_error) {
  // A missing or incomplete report intentionally keeps cloud preview audio disabled.
}

for (const spot of spots.data) {
  spotDetails[spot.id] = await get(`/spots/${encodeURIComponent(spot.id)}`);
  const narrationResource = await get(`/spots/${encodeURIComponent(spot.id)}/narrations`);
  narrations[spot.id] = {
    ...narrationResource,
    data: (narrationResource.data || []).map((narration) => {
      if (narration.audioType !== 'system-tts-preview') return narration;
      if (narration.languageCode !== 'zh-CN') {
        return {
          ...narration,
          audioUrl: '',
          audioReady: false,
          notice: `${narration.languageLabel}试听尚未完成云端发布校验，请先阅读文字稿`,
        };
      }
      const cloudFileId = verifiedCloudAudio.get(spot.id) || '';
      return {
        ...narration,
        audioUrl: cloudFileId,
        audioReady: Boolean(cloudFileId),
        notice: cloudFileId
          ? '普通话试听已通过云端文件校验，内容与发音仍待景区审核'
          : '普通话试听尚未完成云端发布校验，请先阅读文字稿',
      };
    }),
  };
  try { craftGuides[spot.id] = await get(`/spots/${encodeURIComponent(spot.id)}/craft-guide`); }
  catch (_error) { /* Most spots intentionally have no craft guide. */ }
}
for (const panorama of panoramas.data) panoramaDetails[panorama.id] = await get(`/panoramas/${encodeURIComponent(panorama.id)}`);

const recommendations = {};
for (const category of ['food', 'hotel', 'transport', 'attraction']) {
  recommendations[category] = await get(`/recommendations?category=${category}`);
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  spots,
  spotDetails,
  narrations,
  craftGuides,
  panoramas,
  panoramaDetails,
  service: await get('/service'),
  recommendations,
  routes: await get('/routes'),
  siteMap: await get('/site-map'),
  faqs: reviewedFaqs.map((faq) => ({ ...faq, reviewStatus: 'pending-scenic-review', publicStatus: 'review-draft' })),
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`云端只读数据已导出：${outputPath}`);
console.log(`云端普通话试听：${verifiedCloudAudio.size}/15 已通过文件校验`);
