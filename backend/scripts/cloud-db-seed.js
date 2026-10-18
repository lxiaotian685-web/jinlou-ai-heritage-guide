// 把游客端只读快照 data.json 灌入云数据库集合 bijiang_content。
// 数据模型：一个资源一个文档，便于以后只改一个景点。
//   - 简单资源：_id 直接用 data.json 的顶层键，内容放在 value 字段
//   - 映射资源：_id 形如 "spotDetails:jinlou"，每个景点/全景单独一个文档
// 幂等：全部使用 upsert，可重复执行；只写自己的集合，不触碰环境中其他集合。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const backendDirectory = resolve(scriptDirectory, '..');
const snapshotPath = resolve(backendDirectory, '../frontend/cloudfunctions/bijiang-api/data.json');
const collection = 'bijiang_content';
const envId = process.env.CLOUD_ENV_ID || 'cloud1-d8gmw1jur6dc98110';
const tcbEntry = resolve(backendDirectory, '../../.tools/cloudbase-cli/node_modules/@cloudbase/cli/bin/tcb');
// Windows 命令行上限约 32767 字符；留足余量按批拆分。
const batchLimit = Number(process.env.CLOUD_SEED_BATCH_LIMIT || 16000);

const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const simpleKeys = ['spots', 'panoramas', 'craftGuides', 'service', 'recommendations', 'routes', 'siteMap', 'faqs'];
const mapKeys = ['spotDetails', 'narrations', 'panoramaDetails'];

const seededAt = new Date().toISOString();
const documents = [];

for (const key of simpleKeys) {
  if (snapshot[key] === undefined) continue;
  documents.push({ _id: key, value: snapshot[key] });
}
for (const key of mapKeys) {
  for (const [id, value] of Object.entries(snapshot[key] || {})) {
    documents.push({ _id: `${key}:${id}`, value });
  }
}
documents.push({
  _id: 'snapshot-meta',
  value: {
    snapshotGeneratedAt: snapshot.generatedAt || '',
    seededAt,
    simpleKeys,
    mapKeys,
    notice: '教学版云端只读资料；内容仍待景区审核。',
  },
});

function buildCommand(batch) {
  const updates = batch.map((doc) => ({
    q: { _id: doc._id },
    u: { $set: { value: doc.value, source: 'data.json 导出快照', updatedAt: seededAt } },
    upsert: true,
  }));
  const inner = JSON.stringify({ update: collection, updates });
  return JSON.stringify([{ TableName: collection, CommandType: 'UPDATE', Command: inner }]);
}

// 按命令 JSON 长度分批，保证每批都不超过 Windows 命令行限制。
const batches = [];
let current = [];
for (const doc of documents) {
  const candidate = [...current, doc];
  if (current.length && buildCommand(candidate).length > batchLimit) {
    batches.push(current);
    current = [doc];
  } else {
    current = candidate;
  }
}
if (current.length) batches.push(current);

const largest = Math.max(...batches.map((batch) => buildCommand(batch).length));
console.log(`集合 ${collection}：${documents.length} 个文档，分 ${batches.length} 批写入，最大单批命令 ${largest} 字符`);
for (const [index, batch] of batches.entries()) {
  console.log(`  第${index + 1}批：${batch.length} 个文档（${batch[0]._id} … ${batch[batch.length - 1]._id}）`);
}

if (process.env.CLOUD_SEED_DRY_RUN === 'true') {
  console.log('试运行模式，未写入云端。');
  process.exit(0);
}

const directory = mkdtempSync(join(tmpdir(), 'bijiang-cloud-seed-'));
let written = 0;
for (const [index, batch] of batches.entries()) {
  const commandJson = buildCommand(batch);
  const commandFile = join(directory, `batch-${index + 1}.json`);
  writeFileSync(commandFile, commandJson, 'utf8');
  const result = spawnSync(process.execPath, [tcbEntry, 'db', 'nosql', 'execute', '--command', commandJson, '-e', envId], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    console.error(`第${index + 1}批写入失败（命令文件：${commandFile}）。`);
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    if (result.error) console.error(result.error.message);
    process.exit(result.status ?? 1);
  }
  written += batch.length;
  console.log(`  第${index + 1}批写入成功（累计 ${written} 个文档）`);
}
console.log('云数据库写入完成。');
