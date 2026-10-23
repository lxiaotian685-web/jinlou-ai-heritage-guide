import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CLOUD_AUDIO_ENV_ID, CLOUD_AUDIO_ROOT, cloudAudioAssets } from '../src/cloud-audio-assets.js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const backendDirectory = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(backendDirectory, '..');
const reportPath = resolve(repositoryRoot, 'docs/cloud-audio-verification.json');
const verifyOnly = process.argv.includes('--verify-only');
const cliCandidates = [
  process.env.CLOUDBASE_CLI,
  resolve(repositoryRoot, '../.tools/cloudbase-cli/node_modules/@cloudbase/cli/bin/tcb'),
].filter(Boolean);
const cliPath = cliCandidates.find((candidate) => existsSync(candidate));

if (!cliPath) {
  console.error('未找到 CloudBase CLI。请先运行：');
  console.error('npm.cmd install --prefix ..\\.tools\\cloudbase-cli @cloudbase/cli');
  console.error('然后运行对应目录下的 tcb login 完成设备码授权。');
  process.exit(1);
}

function runCloudBase(args, label) {
  const result = spawnSync(process.execPath, [cliPath, ...args, '-e', CLOUD_AUDIO_ENV_ID], {
    cwd: backendDirectory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    console.error(`${label}失败。`);
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status ?? 1);
  }
  return result.stdout || '';
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const localAssets = cloudAudioAssets.map((asset) => {
  const localPath = resolve(backendDirectory, `public${asset.localUrl}`);
  if (!existsSync(localPath)) throw new Error(`缺少本地试听文件：${localPath}`);
  const content = readFileSync(localPath);
  if (!content.length) throw new Error(`试听文件为空：${localPath}`);
  return { ...asset, localPath, size: content.length, localSha256: sha256(localPath) };
});

if (!verifyOnly) {
  for (const asset of localAssets) {
    runCloudBase(['storage', 'upload', asset.localPath, asset.cloudPath, '--times', '3'], `上传 ${asset.filename}`);
    console.log(`✓ 已上传 ${asset.filename}`);
  }
}

const tempDirectory = mkdtempSync(join(tmpdir(), 'bijiang-cloud-audio-'));
const verifiedFiles = [];
try {
  for (const asset of localAssets) {
    const downloadedPath = join(tempDirectory, asset.filename);
    runCloudBase(['storage', 'download', asset.cloudPath, downloadedPath], `下载核验 ${asset.filename}`);
    const downloadedSha256 = sha256(downloadedPath);
    if (downloadedSha256 !== asset.localSha256) throw new Error(`${asset.filename} 云端下载文件与本地原文件哈希不一致`);
    verifiedFiles.push({
      narrationId: asset.narrationId,
      spotId: asset.spotId,
      filename: asset.filename,
      cloudPath: asset.cloudPath,
      cloudFileId: asset.cloudFileId,
      size: asset.size,
      localSha256: asset.localSha256,
      downloadedSha256,
    });
    console.log(`✓ 已核验 ${asset.filename}（${asset.size} bytes）`);
  }
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}

const report = {
  status: 'verified',
  verifiedAt: new Date().toISOString(),
  environmentId: CLOUD_AUDIO_ENV_ID,
  cloudRoot: CLOUD_AUDIO_ROOT,
  verificationMethod: 'CloudBase CLI authenticated upload/download with SHA-256 comparison',
  realDevicePlaybackStatus: 'not-run',
  files: verifiedFiles,
};
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`云端音频核验完成：${verifiedFiles.length}/15，报告写入 ${reportPath}`);
