import { reviewedNarrations } from './reviewed-narrations.js';

export const MANDARIN_PREVIEW_AUDIO_MIGRATION = '20261018-enable-mandarin-preview-audio';

function ensureMigrationTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) STRICT`);
}

function applyMandarinPreviewAudioMigration(db) {
  const upsert = db.prepare(`
    INSERT INTO narrations
      (id, spot_id, language_code, language_label, transcript, audio_url, review_status, audio_type)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    ON CONFLICT(spot_id, language_code) DO UPDATE SET
      audio_url = CASE
        WHEN narrations.audio_url = '' AND narrations.audio_type = 'none' THEN excluded.audio_url
        ELSE narrations.audio_url
      END,
      audio_type = CASE
        WHEN narrations.audio_url = '' AND narrations.audio_type = 'none' THEN excluded.audio_type
        ELSE narrations.audio_type
      END
  `);

  for (const item of reviewedNarrations) {
    upsert.run(
      item.id,
      item.spotId,
      item.languageCode,
      item.languageLabel,
      item.transcript,
      item.audioUrl,
      item.audioType,
    );
  }

  db.exec(`UPDATE spots SET has_audio = CASE WHEN EXISTS (
    SELECT 1 FROM narrations
    WHERE narrations.spot_id = spots.id AND narrations.audio_url <> ''
  ) THEN 1 ELSE 0 END`);
}

export function runDatabaseMigrations(db) {
  ensureMigrationTable(db);
  const applied = new Set(db.prepare('SELECT id FROM schema_migrations').all().map((row) => row.id));
  const newlyApplied = [];

  if (!applied.has(MANDARIN_PREVIEW_AUDIO_MIGRATION)) {
    db.exec('BEGIN IMMEDIATE');
    try {
      applyMandarinPreviewAudioMigration(db);
      db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(MANDARIN_PREVIEW_AUDIO_MIGRATION);
      db.exec('COMMIT');
      newlyApplied.push(MANDARIN_PREVIEW_AUDIO_MIGRATION);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  return newlyApplied;
}
