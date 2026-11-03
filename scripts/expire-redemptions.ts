import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { expireOverdueRedemptions } from '../src/lib/services/points';

/**
 * Standalone expiry job for Windows Task Scheduler, cron, or a container
 * sidecar. The hosted alternative is GET /api/cron/expire with CRON_SECRET.
 */
async function main() {
  const startedAt = Date.now();
  const expired = await expireOverdueRedemptions();

  console.log(
    `[expire-redemptions] ${new Date().toISOString()} expired=${expired} durationMs=${
      Date.now() - startedAt
    }`
  );
}

main()
  .catch((error) => {
    console.error('[expire-redemptions] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
