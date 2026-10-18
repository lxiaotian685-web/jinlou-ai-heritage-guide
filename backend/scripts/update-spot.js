import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createBackup } from './backup-db.js';

const fieldConfig = {
  name: { column: 'name', label: '名称', maxLength: 60 },
  summary: { column: 'summary', label: '简介', maxLength: 1000 },
  category: { column: 'category', label: '类别', maxLength: 40 },
};

function normalizeChanges(changes) {
  return Object.fromEntries(Object.entries(fieldConfig).flatMap(([field, config]) => {
    if (changes[field] === undefined) return [];
    const value = String(changes[field]).trim();
    if (!value) throw new Error(`${config.label}不能为空`);
    if (value.length > config.maxLength) throw new Error(`${config.label}不能超过${config.maxLength}个字符`);
    return [[field, value]];
  }));
}

function serializeSpot(row) {
  return { id: row.id, name: row.name, summary: row.summary, category: row.category };
}

export function updateSpotContent({ databasePath, backupDirectory, spotId, changes }) {
  const targetPath = resolve(databasePath);
  const targetBackupDirectory = resolve(backupDirectory);
  if (!spotId?.trim()) throw new Error('必须提供景点ID');
  if (!existsSync(targetPath)) throw new Error(`找不到数据库：${targetPath}`);
  const normalizedChanges = normalizeChanges(changes || {});
  if (!Object.keys(normalizedChanges).length) throw new Error('至少提供名称、简介或类别中的一项修改');

  let db = new DatabaseSync(targetPath);
  const existingRow = db.prepare('SELECT id, name, summary, category FROM spots WHERE id = ?').get(spotId);
  db.close();
  db = null;
  if (!existingRow) throw new Error(`未找到景点：${spotId}`);
  const changedEntries = Object.entries(normalizedChanges).filter(([field, value]) => existingRow[field] !== value);
  if (!changedEntries.length) return { changed: false, before: serializeSpot(existingRow), after: serializeSpot(existingRow), backupPath: '' };

  const backup = createBackup({ databasePath: targetPath, backupDirectory: targetBackupDirectory });
  db = new DatabaseSync(targetPath);
  try {
    const assignments = changedEntries.map(([field]) => `${fieldConfig[field].column} = ?`).join(', ');
    const values = changedEntries.map(([, value]) => value);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`UPDATE spots SET ${assignments} WHERE id = ?`).run(...values, spotId);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const updatedRow = db.prepare('SELECT id, name, summary, category FROM spots WHERE id = ?').get(spotId);
    return {
      changed: true,
      before: serializeSpot(existingRow),
      after: serializeSpot(updatedRow),
      backupPath: backup.backupPath,
    };
  } finally {
    db.close();
  }
}

function parseArguments(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!key.startsWith('--')) continue;
    values[key.slice(2)] = args[index + 1];
    index += 1;
  }
  return values;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArguments(process.argv.slice(2));
  try {
    const result = updateSpotContent({
      databasePath: process.env.DATABASE_PATH || 'data/bijiang.db',
      backupDirectory: process.env.BACKUP_DIRECTORY || 'data/backups',
      spotId: args.id,
      changes: { name: args.name, summary: args.summary, category: args.category },
    });
    if (!result.changed) {
      console.log('内容与当前数据库相同，没有写入，也没有生成备份。');
    } else {
      console.log(`景点更新完成：${result.after.id} / ${result.after.name}`);
      console.log(`修改前备份：${result.backupPath}`);
      console.log(`当前类别：${result.after.category}`);
      console.log(`当前简介：${result.after.summary}`);
    }
  } catch (error) {
    console.error(`内容更新失败：${error.message}`);
    process.exitCode = 1;
  }
}
