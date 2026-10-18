import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { reviewedNarrations } from '../src/reviewed-narrations.js';
import { createBackup } from './backup-db.js';

export function applyReviewedNarrations({ databasePath, backupDirectory }) {
  const targetPath = resolve(databasePath);
  if (!existsSync(targetPath)) throw new Error(`找不到数据库：${targetPath}`);

  const backup = createBackup({ databasePath: targetPath, backupDirectory: resolve(backupDirectory) });
  const db = new DatabaseSync(targetPath);
  try {
    const upsert = db.prepare(`
      INSERT INTO narrations
        (id, spot_id, language_code, language_label, transcript, audio_url, review_status, audio_type)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', 'none')
      ON CONFLICT(spot_id, language_code) DO UPDATE SET
        id = excluded.id,
        language_label = excluded.language_label,
        transcript = excluded.transcript,
        audio_url = excluded.audio_url,
        review_status = excluded.review_status,
        audio_type = excluded.audio_type
    `);
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const item of reviewedNarrations) {
        upsert.run(item.id, item.spotId, item.languageCode, item.languageLabel, item.transcript, item.audioUrl);
      }
      db.exec('UPDATE spots SET has_audio = 0');
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return { updated: reviewedNarrations.length, backupPath: backup.backupPath };
  } finally {
    db.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = applyReviewedNarrations({
      databasePath: process.env.DATABASE_PATH || 'data/bijiang.db',
      backupDirectory: process.env.BACKUP_DIRECTORY || 'data/backups',
    });
    console.log(`普通话讲解更新完成：${result.updated}条`);
    console.log(`修改前备份：${result.backupPath}`);
  } catch (error) {
    console.error(`讲解更新失败：${error.message}`);
    process.exitCode = 1;
  }
}
