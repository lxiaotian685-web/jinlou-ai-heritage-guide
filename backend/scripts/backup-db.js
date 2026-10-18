import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const contentTables = [
  'spots',
  'panoramas',
  'panorama_hotspots',
  'service_config',
  'recommendations',
  'tour_routes',
  'tour_route_points',
  'site_points',
  'narrations',
  'craft_guides',
  'assistant_faqs',
];

function backupTimestamp(date) {
  const pad = (value, length = 2) => String(value).padStart(length, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    '-',
    pad(date.getMilliseconds(), 3),
  ].join('');
}

function tableCounts(db) {
  const existingTables = new Set(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(({ name }) => name),
  );
  return Object.fromEntries(contentTables.filter((table) => existingTables.has(table)).map((table) => [
    table,
    db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total,
  ]));
}

function assertHealthy(db, label) {
  const result = db.prepare('PRAGMA quick_check').get();
  if (result.quick_check !== 'ok') throw new Error(`${label}完整性检查失败：${result.quick_check}`);
}

export function createBackup({ databasePath, backupDirectory, now = new Date() }) {
  const sourcePath = resolve(databasePath);
  const targetDirectory = resolve(backupDirectory);
  if (!existsSync(sourcePath)) throw new Error(`找不到数据库：${sourcePath}`);
  mkdirSync(targetDirectory, { recursive: true });

  const backupPath = resolve(targetDirectory, `bijiang-${backupTimestamp(now)}.db`);
  let sourceDb;
  try {
    sourceDb = new DatabaseSync(sourcePath, { readOnly: true });
    assertHealthy(sourceDb, '源数据库');
    const sourceCounts = tableCounts(sourceDb);
    const escapedBackupPath = backupPath.replaceAll("'", "''");
    try {
      sourceDb.exec(`VACUUM INTO '${escapedBackupPath}'`);
    } catch (error) {
      if (!/unable to open database/i.test(error.message)) throw error;
      if (existsSync(backupPath)) rmSync(backupPath, { force: true });
      writeFileSync(backupPath, sourceDb.serialize());
    }
    sourceDb.close();
    sourceDb = null;

    const backupDb = new DatabaseSync(backupPath, { readOnly: true });
    try {
      assertHealthy(backupDb, '备份数据库');
      const backupCounts = tableCounts(backupDb);
      if (JSON.stringify(backupCounts) !== JSON.stringify(sourceCounts)) {
        throw new Error('备份记录数量与源数据库不一致');
      }
      return { backupPath, size: statSync(backupPath).size, counts: backupCounts };
    } finally {
      backupDb.close();
    }
  } catch (error) {
    if (existsSync(backupPath)) rmSync(backupPath, { force: true });
    throw error;
  } finally {
    sourceDb?.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = createBackup({
      databasePath: process.env.DATABASE_PATH || 'data/bijiang.db',
      backupDirectory: process.env.BACKUP_DIRECTORY || 'data/backups',
    });
    console.log(`备份完成：${result.backupPath}`);
    console.log(`文件大小：${result.size} 字节`);
    console.log(`核心数据：景点 ${result.counts.spots}，路线 ${result.counts.tour_routes}，点位 ${result.counts.site_points}`);
  } catch (error) {
    console.error(`备份失败：${error.message}`);
    process.exitCode = 1;
  }
}
