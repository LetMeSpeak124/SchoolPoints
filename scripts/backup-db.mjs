import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const KEEP_BACKUPS = 14;
const prisma = new PrismaClient();

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? '';

  if (!databaseUrl.startsWith('file:')) {
    throw new Error(
      'db:backup currently supports the SQLite database only (DATABASE_URL must start with file:).'
    );
  }

  const backupDir = path.resolve(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const fileName = `schoolpoints-${timestamp()}.db`;
  const destination = path.join(backupDir, fileName);
  const sqliteDestination = destination.replace(/\\/g, '/').replace(/'/g, "''");

  // VACUUM INTO creates a consistent, compact snapshot without stopping the
  // app. A plain file copy could capture a half-written SQLite database.
  await prisma.$executeRawUnsafe(`VACUUM INTO '${sqliteDestination}'`);

  const sizeMb = fs.statSync(destination).size / (1024 * 1024);

  const backups = fs
    .readdirSync(backupDir)
    .filter((file) => file.endsWith('.db'))
    .sort()
    .reverse();

  for (const stale of backups.slice(KEEP_BACKUPS)) {
    fs.unlinkSync(path.join(backupDir, stale));
  }

  console.log(
    `[db:backup] wrote ${path.relative(process.cwd(), destination)} (${sizeMb.toFixed(
      2
    )} MB), keeping the newest ${KEEP_BACKUPS} backups`
  );
}

main()
  .catch((error) => {
    console.error('[db:backup] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
