import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { reviewedSpotContent } from '../src/reviewed-spots.js';
import { createBackup } from './backup-db.js';

export function applyReviewedSpots({ databasePath, backupDirectory }) {
  const targetPath = resolve(databasePath);
  if (!existsSync(targetPath)) throw new Error(`找不到数据库：${targetPath}`);
  const db = new DatabaseSync(targetPath);
  try {
    const ids = new Set(db.prepare('SELECT id FROM spots').all().map((row) => row.id));
    const missing = reviewedSpotContent.filter((spot) => !ids.has(spot.id)).map((spot) => spot.id);
    if (missing.length) throw new Error(`数据库缺少景点：${missing.join(', ')}`);
  } finally {
    db.close();
  }

  const backup = createBackup({ databasePath: targetPath, backupDirectory: resolve(backupDirectory) });
  const writableDb = new DatabaseSync(targetPath);
  try {
    const update = writableDb.prepare('UPDATE spots SET category = ?, summary = ? WHERE id = ?');
    writableDb.exec('BEGIN IMMEDIATE');
    try {
      for (const spot of reviewedSpotContent) update.run(spot.category, spot.summary, spot.id);
      writableDb.exec('COMMIT');
    } catch (error) {
      writableDb.exec('ROLLBACK');
      throw error;
    }
    return { updated: reviewedSpotContent.length, backupPath: backup.backupPath };
  } finally {
    writableDb.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = applyReviewedSpots({
      databasePath: process.env.DATABASE_PATH || 'data/bijiang.db',
      backupDirectory: process.env.BACKUP_DIRECTORY || 'data/backups',
    });
    console.log(`景点资料更新完成：${result.updated}条`);
    console.log(`修改前备份：${result.backupPath}`);
  } catch (error) {
    console.error(`景点资料更新失败：${error.message}`);
    process.exitCode = 1;
  }
}
