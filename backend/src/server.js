import { resolve } from 'node:path';
import { createApp } from './app.js';
import { createDatabase } from './db.js';

const port = Number(process.env.PORT || 3000);
const databasePath = process.env.DATABASE_PATH || resolve('data/bijiang.db');
const backupDirectory = process.env.BACKUP_DIRECTORY || resolve('data/backups');
const adminToken = process.env.ADMIN_TOKEN || '';
const db = createDatabase(databasePath);
const server = createApp(db, { databasePath, backupDirectory, adminToken }).listen(port, () => {
  console.log(`Bijiang Explorer API: http://127.0.0.1:${port}/api/v1`);
  console.log(adminToken
    ? `内容管理入口：http://127.0.0.1:${port}/admin`
    : '内容管理未启用：请先设置 ADMIN_TOKEN');
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
