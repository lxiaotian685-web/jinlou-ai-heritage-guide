import { resolve } from 'node:path';
import { createDatabase } from '../src/db.js';

const databasePath = resolve(process.env.DATABASE_PATH || 'data/bijiang.db');
const db = createDatabase(databasePath);

try {
  const migrations = db.prepare('SELECT id, applied_at AS appliedAt FROM schema_migrations ORDER BY applied_at, id').all();
  const previews = db.prepare(`SELECT COUNT(*) AS total FROM narrations
    WHERE language_code = 'zh-CN' AND audio_url <> '' AND audio_type = 'system-tts-preview'`).get().total;
  const playableSpots = db.prepare('SELECT COUNT(*) AS total FROM spots WHERE has_audio = 1').get().total;
  console.log(JSON.stringify({ databasePath, migrations, mandarinPreviews: previews, playableSpots }, null, 2));
} finally {
  db.close();
}
