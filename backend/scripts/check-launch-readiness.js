import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateLaunchReadiness } from '../src/launch-readiness.js';

const profilePath = resolve(process.argv[2] || 'config/launch-profile.example.json');
const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
const result = evaluateLaunchReadiness(profile);

console.log(`上线资料：${result.completedCount}/${result.totalCount}`);
for (const item of result.checks) console.log(`${item.ready ? '✓' : '○'} ${item.label}`);
console.log(result.ready ? '结论：资料齐全，可以进入微信平台提交前复核。' : `结论：尚缺${result.missing.length}项，不能标记为可上线。`);
process.exitCode = result.ready ? 0 : 2;
