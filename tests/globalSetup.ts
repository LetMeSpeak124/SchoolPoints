import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Creates a disposable SQLite database for the test run. The normal dev.db is
 * never touched by tests.
 */
export default function setup() {
  const root = path.resolve(__dirname, '..');
  const dbPath = path.join(root, 'prisma', 'test.db');

  for (const file of [dbPath, `${dbPath}-journal`]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  execSync('npx prisma migrate deploy', {
    cwd: root,
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'inherit',
  });
}
