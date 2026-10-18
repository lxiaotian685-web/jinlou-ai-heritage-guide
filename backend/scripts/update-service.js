import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createBackup } from './backup-db.js';

const fields = {
  address: { column: 'address', label: '地址', maxLength: 200 },
  openingHours: { column: 'opening_hours', label: '开放时间', maxLength: 200 },
  phone: { column: 'phone', label: '联系电话', maxLength: 40 },
  transport: { column: 'transport', label: '交通信息', maxLength: 500 },
  ticketUrl: { column: 'ticket_url', label: '订票链接', maxLength: 500, allowEmpty: true },
  latitude: { column: 'latitude', label: '纬度', number: true },
  longitude: { column: 'longitude', label: '经度', number: true },
};

function normalizeChanges(changes) {
  return Object.fromEntries(Object.entries(fields).flatMap(([field, config]) => {
    if (changes[field] === undefined) return [];
    if (config.number) {
      const value = Number(changes[field]);
      if (!Number.isFinite(value)) throw new Error(`${config.label}必须是数字`);
      return [[field, value]];
    }
    const value = String(changes[field]).trim();
    if (!value && !config.allowEmpty) throw new Error(`${config.label}不能为空`);
    if (value.length > config.maxLength) throw new Error(`${config.label}不能超过${config.maxLength}个字符`);
    return [[field, value]];
  }));
}

function serialize(row) {
  return {
    address: row.address,
    openingHours: row.opening_hours,
    phone: row.phone,
    transport: row.transport,
    ticketUrl: row.ticket_url,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

export function updateServiceContent({ databasePath, backupDirectory, changes }) {
  const targetPath = resolve(databasePath);
  if (!existsSync(targetPath)) throw new Error(`找不到数据库：${targetPath}`);
  const normalized = normalizeChanges(changes || {});
  if (!Object.keys(normalized).length) throw new Error('至少提供一项服务信息修改');

  let db = new DatabaseSync(targetPath);
  const beforeRow = db.prepare('SELECT * FROM service_config WHERE id = 1').get();
  db.close();
  db = null;
  if (!beforeRow) throw new Error('数据库中没有服务信息');

  const changedEntries = Object.entries(normalized).filter(([field, value]) => beforeRow[fields[field].column] !== value);
  if (!changedEntries.length) return { changed: false, before: serialize(beforeRow), after: serialize(beforeRow), backupPath: '' };

  const backup = createBackup({ databasePath: targetPath, backupDirectory: resolve(backupDirectory) });
  db = new DatabaseSync(targetPath);
  try {
    const assignments = changedEntries.map(([field]) => `${fields[field].column} = ?`).join(', ');
    const values = changedEntries.map(([, value]) => value);
    db.prepare(`UPDATE service_config SET ${assignments} WHERE id = 1`).run(...values);
    return {
      changed: true,
      before: serialize(beforeRow),
      after: serialize(db.prepare('SELECT * FROM service_config WHERE id = 1').get()),
      backupPath: backup.backupPath,
    };
  } finally {
    db.close();
  }
}

function parseArguments(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    if (!args[index].startsWith('--')) continue;
    values[args[index].slice(2)] = args[index + 1];
    index += 1;
  }
  return values;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArguments(process.argv.slice(2));
  try {
    const result = updateServiceContent({
      databasePath: process.env.DATABASE_PATH || 'data/bijiang.db',
      backupDirectory: process.env.BACKUP_DIRECTORY || 'data/backups',
      changes: args,
    });
    console.log(result.changed ? `服务信息更新完成；修改前备份：${result.backupPath}` : '服务信息没有变化，无需写入。');
  } catch (error) {
    console.error(`服务信息更新失败：${error.message}`);
    process.exitCode = 1;
  }
}
