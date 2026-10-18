// 本地检查云端只读接口的容错与鉴权逻辑。
// 本机没有安装 wx-server-sdk，因此这里同时验证“依赖缺失时回退到打包快照”这条安全路径。
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const backendDirectory = resolve(scriptDirectory, '..');
const functionPath = resolve(backendDirectory, '../frontend/cloudfunctions/bijiang-api/index.js');

const require = createRequire(import.meta.url);
const checks = [];
const check = (label, passed, detail = '') => checks.push({ label, passed: Boolean(passed), detail });

// 本机没有云数据库和 wx-server-sdk，回退警告属预期，这里在加载前静音以免污染检查输出。
const originalWarn = console.warn;
console.warn = () => {};
const api = require(functionPath);
const spots = await api.main({ path: '/spots', method: 'GET' });
check('快照回退可读取景点', spots.ok === true && spots.response?.data?.length === 15, `${spots.response?.data?.length ?? '无'}/15`);

const service = await api.main({ path: '/service', method: 'GET' });
check('快照回退可读取服务信息', service.ok === true && Boolean(service.response?.data?.phone), service.response?.data?.phone || '无');

const answer = await api.main({ path: '/assistant/chat', method: 'POST', body: { question: '金楼是什么建筑？' } });
check('知识问答仍可用', answer.ok === true && Boolean(answer.response?.data?.answer));

const removed = await api.main({ path: '/spots/jinlou/interactions', method: 'GET' });
check('已移除的互动接口不再暴露', removed.ok === false && removed.error?.code === 'NOT_FOUND');

const noToken = await api.main({ path: '/admin/session', method: 'POST' });
check('管理员接口默认拒绝访问', noToken.ok === false && noToken.error?.code === 'ADMIN_UNAUTHORIZED');

process.env.BIJIANG_ADMIN_TOKEN = 'local-check-token-0123456789';
const wrongToken = await api.main({ path: '/admin/session', method: 'POST', adminToken: 'wrong-token-0123456789' });
check('错误口令被拒绝', wrongToken.ok === false && wrongToken.error?.code === 'ADMIN_UNAUTHORIZED');

const okToken = await api.main({ path: '/admin/session', method: 'POST', adminToken: 'local-check-token-0123456789' });
check('正确口令可读取数据源状态', okToken.ok === true && okToken.response?.data?.authorized === true, okToken.response?.data?.dataSource || '无');
const adminSpots = await api.main({ path: '/admin/spots', method: 'GET', adminToken: 'local-check-token-0123456789' });
check('正确口令可读取管理景点', adminSpots.ok === true && adminSpots.response?.data?.length === 15, `${adminSpots.response?.data?.length ?? '无'}/15`);
const dashboard = await api.main({ path: '/admin/dashboard', method: 'GET', adminToken: 'local-check-token-0123456789' });
check('网页后台仪表盘资料完整', dashboard.ok === true && dashboard.response?.data?.spots?.length === 15 && dashboard.response?.data?.narrations?.length >= 15);
const analytics = await api.main({ path: '/admin/recommendation-analytics', method: 'GET', adminToken: 'local-check-token-0123456789' });
check('无数据库时运营统计安全返回空数据', analytics.ok === true && analytics.response?.data?.total === 0 && Array.isArray(analytics.response?.data?.items));
const home = await api.main({ path: '/home', method: 'GET' });
check('首页云端配置有安全默认值', home.ok === true && home.response?.data?.heroImage === '/images/jinlou-home-hero-v2.jpg');
const invalidWrite = await api.main({ path: '/admin/spots/jinlou', method: 'PATCH', adminToken: 'local-check-token-0123456789', body: { name: '', category: '', summary: '' } });
check('云端写入校验拒绝空内容', invalidWrite.ok === false && invalidWrite.error?.code === 'INVALID_SPOT_CONTENT');
const invalidRecommendation = await api.main({ path: '/admin/recommendations', method: 'PUT', adminToken: 'local-check-token-0123456789', body: { category: 'unknown' } });
check('广告管理拒绝非法分类', invalidRecommendation.ok === false && invalidRecommendation.error?.code === 'INVALID_RECOMMENDATION');
delete process.env.BIJIANG_ADMIN_TOKEN;
console.warn = originalWarn;

for (const item of checks) console.log(`${item.passed ? '✓' : '✗'} ${item.label}${item.detail ? `：${item.detail}` : ''}`);
const failures = checks.filter((item) => !item.passed);
if (failures.length) {
  console.log(`云端接口本地检查：${failures.length} 项未通过。`);
  process.exitCode = 1;
} else {
  console.log(`云端接口本地检查：${checks.length} 项全部通过。`);
}
