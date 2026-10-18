import { copyFileSync, existsSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createBackup } from './backup-db.js';

const requiredTables = ['spots', 'tour_routes', 'site_points'];

function inspectDatabase(databasePath) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const quickCheck = db.prepare('PRAGMA quick_check').get().quick_check;
    if (quickCheck !== 'ok') throw new Error(`数据库完整性检查失败：${quickCheck}`);
    return Object.fromEntries(requiredTables.map((table) => [
      table,
      db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total,
    ]));
  } finally {
    db.close();
  }
}

export function restoreDatabase({ backupPath, databasePath, backupDirectory, confirmed = false }) {
  if (!confirmed) throw new Error('恢复会替换当前数据库，必须提供 --confirm');
  const sourcePath = resolve(backupPath);
  const targetPath = resolve(databasePath);
  const targetDirectory = resolve(backupDirectory);
  if (!existsSync(sourcePath)) throw new Error(`找不到备份文件：${sourcePath}`);
  if (!existsSync(targetPath)) throw new Error(`找不到当前数据库：${targetPath}`);
  if (sourcePath === targetPath) throw new Error('备份文件不能与当前数据库相同');

  const expectedCounts = inspectDatabase(sourcePath);
  const safetyBackup = createBackup({ databasePath: targetPath, backupDirectory: targetDirectory });
  const token = `${process.pid}-${Date.now()}`;
  const stagingPath = `${targetPath}.restore-${token}.tmp`;
  const displacedPath = `${targetPath}.before-restore-${token}.tmp`;

  try {
    copyFileSync(sourcePath, stagingPath);
    const stagingCounts = inspectDatabase(stagingPath);
    if (JSON.stringify(stagingCounts) !== JSON.stringify(expectedCounts)) {
      throw new Error('恢复临时文件与所选备份记录数量不一致');
    }

    renameSync(targetPath, displacedPath);
    try {
      renameSync(stagingPath, targetPath);
      const restoredCounts = inspectDatabase(targetPath);
      if (JSON.stringify(restoredCounts) !== JSON.stringify(expectedCounts)) {
        throw new Error('恢复后的数据库校验失败');
      }
      rmSync(displacedPath, { force: true });
      return { databasePath: targetPath, safetyBackupPath: safetyBackup.backupPath, counts: restoredCounts };
    } catch (error) {
      if (existsSync(targetPath)) rmSync(targetPath, { force: true });
      if (existsSync(displacedPath)) renameSync(displacedPath, targetPath);
      throw error;
    }
  } finally {
    if (existsSync(stagingPath)) rmSync(stagingPath, { force: true });
    if (existsSync(displacedPath) && !existsSync(targetPath)) renameSync(displacedPath, targetPath);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const backupPath = args.find((value) => value !== '--confirm');
  try {
    if (!backupPath) throw new Error('请指定备份文件，例如：npm.cmd run restore -- "data/backups/文件名.db" --confirm');
    const result = restoreDatabase({
      backupPath,
      databasePath: process.env.DATABASE_PATH || 'data/bijiang.db',
      backupDirectory: process.env.BACKUP_DIRECTORY || 'data/backups',
      confirmed: args.includes('--confirm'),
    });
    console.log(`恢复完成：${result.databasePath}`);
    console.log(`恢复前安全备份：${result.safetyBackupPath}`);
    console.log(`核心数据：景点 ${result.counts.spots}，路线 ${result.counts.tour_routes}，点位 ${result.counts.site_points}`);
  } catch (error) {
    console.error(`恢复失败：${error.message}`);
    console.error('执行恢复前请先停止后端服务。');
    process.exitCode = 1;
  }
}
