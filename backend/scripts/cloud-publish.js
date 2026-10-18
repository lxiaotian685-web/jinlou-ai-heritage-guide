// 一键把本地内容发布到云端：先导出最新快照，再灌入云数据库集合。
// 这样“改了本地内容却忘了更新云端”不会再发生。
// 用法：先启动本地后端（npm.cmd run dev），再执行 npm.cmd run cloud:publish
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const apiBaseUrl = process.env.BIJIANG_EXPORT_API || 'http://127.0.0.1:3000/api/v1';

function run(script, label) {
  const result = spawnSync(process.execPath, [resolve(scriptDirectory, script)], {
    encoding: 'utf8',
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (result.status !== 0) {
    console.error(`${label} 失败，已中止发布。`);
    process.exit(result.status ?? 1);
  }
}

try {
  const response = await fetch(`${apiBaseUrl}/health`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
} catch (error) {
  console.error(`无法连接本地后端 ${apiBaseUrl}（${error.message}）。`);
  console.error('请先在 BijiangExplorer/backend 运行 npm.cmd run dev。');
  console.error('若只想用当前 data.json 更新云端，可单独运行 npm.cmd run cloud:seed。');
  process.exit(1);
}

console.log('第1步：从本地后端导出最新快照…');
run('export-cloud-read-api-data.js', '导出快照');

console.log('第2步：写入云数据库…');
run('cloud-db-seed.js', '写入云数据库');

console.log('发布完成：小程序下次调用会读取最新云端内容（云函数缓存最长1分钟）。');
