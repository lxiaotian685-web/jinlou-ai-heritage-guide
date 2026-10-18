import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { evaluateLaunchReadiness } from '../src/launch-readiness.js';

const databasePath = resolve(process.env.DATABASE_PATH || 'data/bijiang.db');
const frontendRoot = resolve('../frontend/miniprogram');
const checks = [];
const check = (label, passed, detail = '') => checks.push({ label, passed: Boolean(passed), detail });
const db = new DatabaseSync(databasePath, { readOnly: true });

try {
  check('数据库完整性', db.prepare('PRAGMA quick_check').get().quick_check === 'ok');
  const spots = db.prepare('SELECT id, name FROM spots').all();
  const points = db.prepare('SELECT number, name FROM site_points').all();
  const routes = db.prepare('SELECT id, stops_json FROM tour_routes').all();
  check('景点数量', spots.length === 15, `${spots.length}/15`);
  check('地图点位数量', points.length === 15, `${points.length}/15`);
  check('参考路线数量', routes.length === 3, `${routes.length}/3`);
  const spotNames = new Set(points.map((item) => item.name));
  const invalidStops = routes.flatMap((route) => JSON.parse(route.stops_json).filter((name) => !spotNames.has(name)));
  check('路线站点匹配', invalidStops.length === 0, invalidStops.join('、'));
  const narrations = db.prepare("SELECT spot_id, transcript, audio_url, audio_type FROM narrations WHERE language_code = 'zh-CN'").all();
  check('普通话讲解文字', narrations.length === 15 && narrations.every((item) => item.transcript && !item.transcript.includes('AI合成')), `${narrations.length}/15`);
  const narrationAudioReady = narrations.filter((item) => item.audio_type === 'system-tts-preview' && /^\/media\/narrations\/[a-z0-9-]+-zh\.wav$/.test(item.audio_url) && existsSync(resolve(`public${item.audio_url}`)));
  check('普通话试听音频清单', narrationAudioReady.length === 15, `${narrationAudioReady.length}/15`);

  const appConfig = JSON.parse(readFileSync(resolve(frontendRoot, 'app.json'), 'utf8'));
  const missingPageFiles = appConfig.pages.flatMap((page) => ['js', 'json', 'wxml', 'wxss']
    .map((ext) => resolve(frontendRoot, `${page}.${ext}`)).filter((file) => !existsSync(file)));
  check('小程序页面文件', missingPageFiles.length === 0, `${appConfig.pages.length}页`);

  const localStorage = new Map();
  globalThis.wx = {
    getStorageSync: (key) => localStorage.get(key),
    setStorageSync: (key, value) => localStorage.set(key, value),
    removeStorageSync: (key) => localStorage.delete(key),
  };
  const require = createRequire(import.meta.url);
  const notes = require(resolve(frontendRoot, 'utils/spot-notes.js'));
  notes.saveSpotNote('jinlou', { rating: 5, text: '重点再看木雕' });
  const savedNote = notes.getSpotNote('jinlou');
  notes.removeSpotNote('jinlou');
  check('私人记录本地逻辑', savedNote.rating === 5 && savedNote.text === '重点再看木雕' && notes.getSpotNote('jinlou').rating === 0);
  const displaySettings = require(resolve(frontendRoot, 'utils/display-settings.js'));
  localStorage.set('displaySettings', { fontSize: 'xlarge', highContrast: false });
  check('字号设置兼容', displaySettings.getDisplaySettings().fontSize === 'large');
  const assistantTemplate = readFileSync(resolve(frontendRoot, 'pages/assistant/index.wxml'), 'utf8');
  check('推荐问题与自由提问', assistantTemplate.includes('wx:for="{{quickQuestions}}"') && assistantTemplate.includes('maxlength="200"') && assistantTemplate.includes('bindconfirm="submitQuestion"'));
  const assistantStyles = readFileSync(resolve(frontendRoot, 'pages/assistant/index.wxss'), 'utf8');
  check('问答重试与来源展示', assistantTemplate.includes('retryLastQuestion') && assistantTemplate.includes('answer.sources') && assistantTemplate.includes('copySourceUrl') && assistantStyles.includes('.question-form'));
  const privacyTemplate = readFileSync(resolve(frontendRoot, 'pages/privacy/index.wxml'), 'utf8');
  check('本地数据页面精简', ['data-type="visit"', 'data-type="notes"', 'data-type="display"'].every((item) => privacyTemplate.includes(item)) && !privacyTemplate.includes('接口缓存') && !privacyTemplate.includes('匿名互动标识'));
  const apiService = readFileSync(resolve(frontendRoot, 'services/api.js'), 'utf8');
  check('缓存快速回退', apiService.includes('timeout: cached ? 1500 : 8000'));
  const homeTemplate = readFileSync(resolve(frontendRoot, 'pages/index/index.wxml'), 'utf8');
  check('后台首页文案绑定', homeTemplate.includes('{{home.title}}') && homeTemplate.includes('{{home.subtitle}}'));
  const spotDetailScript = readFileSync(resolve(frontendRoot, 'pages/spot-detail/index.js'), 'utf8');
  check('后台讲解音频地址接入', spotDetailScript.includes("configuredCloudUrl.startsWith('cloud://')") && spotDetailScript.includes('fileID: configuredCloudUrl'));
  const spotDetailTemplate = readFileSync(resolve(frontendRoot, 'pages/spot-detail/index.wxml'), 'utf8');
  check('音频失败保留文字降级', spotDetailScript.includes('audioError') && spotDetailTemplate.includes('{{audioError}}') && spotDetailTemplate.includes('讲解文字稿'));
  const spotImages = require(resolve(frontendRoot, 'utils/spot-images.js'));
  const missingSpotImages = Object.values(spotImages.bundledCovers).filter((imagePath) => !existsSync(resolve(frontendRoot, imagePath.slice(1))));
  check('实拍景点封面', Object.keys(spotImages.bundledCovers).length === 12 && missingSpotImages.length === 0, `${12 - missingSpotImages.length}/12`);
  check('首页叠放轮播图', [1, 2, 3, 4, 5, 6].every((index) => existsSync(resolve(frontendRoot, `images/jinlou-home-slide-${index}.jpg`))));
  const adminWebRoot = resolve(frontendRoot, '../admin-web');
  check('独立云端管理网站', ['index.html', 'styles.css', 'redesign.css', 'app.js', 'config.js', 'assets/home-hero.jpg'].every((file) => existsSync(resolve(adminWebRoot, file))));
  const adminTemplate = readFileSync(resolve(adminWebRoot, 'index.html'), 'utf8');
  const adminScript = readFileSync(resolve(adminWebRoot, 'app.js'), 'utf8');
  check('后台欢迎语包含碧江金楼', adminTemplate.includes('欢迎使用碧江金楼运营管理平台'));
  check('后台图片直接上传', ['选择照片', '图片文件地址', 'uploadSelectedImage', '/admin/media/images'].every((text) => adminTemplate.includes(text) || adminScript.includes(text)));
  const missingAdminSpotImages = Object.values(spotImages.bundledCovers).filter((imagePath) => !existsSync(resolve(adminWebRoot, 'assets/spots', imagePath.split('/').pop())));
  check('后台显示原有景点封面', missingAdminSpotImages.length === 0 && adminScript.includes("shouqingwu: './assets/spots/shouqingwu-cover.jpg'") && adminTemplate.includes('spot-preview-empty'), `${12 - missingAdminSpotImages.length}/12`);
  check('商家分类与上架流程简化', adminTemplate.includes('当前分类') && adminTemplate.includes('保存草稿') && adminTemplate.includes('保存并上架'));
  check('商家缺图不再误用首页封面', adminTemplate.includes('ad-preview-empty') && adminScript.includes('showStoredAdPreview'));
  check('后台运营数据看板', ['运营数据', '商家互动排行', 'analytics-total', '/admin/recommendation-analytics'].every((text) => adminTemplate.includes(text) || adminScript.includes(text)));
  check('后台真实数据图表', ['每日互动柱状图', '用户行为扇形图', '内容分类关注度', 'analytics-daily-bars', 'analytics-action-donut', 'renderAnalyticsCharts'].every((text) => adminTemplate.includes(text) || adminScript.includes(text)));
  check('后台管理系统完整重设计', ['dashboard-heading', 'overview-trend', 'health-list', 'redesign.css'].every((text) => adminTemplate.includes(text)));
  check('后台首页多图轮播管理', ['multiple', 'home-slide-list', '第1张', '保存首页轮播', 'heroImages'].every((text) => adminTemplate.includes(text) || adminScript.includes(text)));
  check('后台轮播预览资源', [1, 2, 3, 4, 5, 6].every((index) => existsSync(resolve(adminWebRoot, `assets/home-slides/jinlou-home-slide-${index}.jpg`))));
  check('景点选图可以撤销', ['spot-cancel-file', '取消本次选择', '已取消本次选择'].every((text) => adminTemplate.includes(text) || adminScript.includes(text)));
  check('景点封面支持恢复上一张', ['spot-restore-previous', 'previousCoverImage', '恢复上一张照片'].every((text) => adminTemplate.includes(text) || adminScript.includes(text)));

  const cloudApiPath = resolve(frontendRoot, '../cloudfunctions/bijiang-api/index.js');
  const cloudApi = readFileSync(cloudApiPath, 'utf8');
  check('云端接口优先云数据库并保留快照回退', cloudApi.includes("require('./data.json')") && cloudApi.includes("collection(COLLECTION)") && cloudApi.includes('bundled-snapshot'));
  check('云端管理鉴权需要环境变量口令', cloudApi.includes('BIJIANG_ADMIN_TOKEN') && cloudApi.includes('timingSafeEqual'));
  check('管理图片由云函数安全上传', cloudApi.includes("path === '/admin/media/images'") && cloudApi.includes('uploadAdminImage') && cloudApi.includes('MAX_ADMIN_IMAGE_BYTES'));
  check('周边推荐匿名点击统计', cloudApi.includes("path === '/recommendations/track'") && cloudApi.includes('bijiang_recommendation_metrics') && cloudApi.includes('trackRecommendationAction'));
  check('云端首页支持轮播数组', cloudApi.includes('heroImages') && cloudApi.includes('slice(0, 8)'));
  check('云端保存景点上一张封面', cloudApi.includes('coverImageChanged') && cloudApi.includes('previousCoverImage: currentCoverImage'));
  check('云端问答推荐与来源同步', cloudApi.includes("path === '/assistant/suggestions'") && cloudApi.includes('resolveKnowledgeSources') && existsSync(resolve(frontendRoot, '../cloudfunctions/bijiang-api/knowledge-sources.js')));
  delete globalThis.wx;

  const launchProfile = JSON.parse(readFileSync(resolve('config/launch-profile.example.json'), 'utf8'));
  const launch = evaluateLaunchReadiness(launchProfile);
  console.log('碧江金楼集中自动验收');
  for (const item of checks) console.log(`${item.passed ? '✓' : '✗'} ${item.label}${item.detail ? `：${item.detail}` : ''}`);
  console.log(`○ 上线资料：${launch.completedCount}/${launch.totalCount}（不影响本地功能验收）`);
  const failures = checks.filter((item) => !item.passed);
  console.log(failures.length ? `结论：${failures.length}项核心检查未通过。` : '结论：核心自动检查全部通过，等待人工体验验收。');
  if (failures.length) process.exitCode = 1;
} finally {
  db.close();
}
