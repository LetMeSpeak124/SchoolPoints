import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { expireOverdueRedemptions } from '@/lib/services/points';
import { processDueJobs } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest, secret: string): boolean {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return false;

  const provided = Buffer.from(header.slice('Bearer '.length));
  const expected = Buffer.from(secret);

  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret || secret.length < 16) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured.' },
      { status: 503 }
    );
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const jobResults = await processDueJobs();
    const expired = await expireOverdueRedemptions();

    return NextResponse.json(
      {
        ok: true,
        expired,
        jobs: jobResults,
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Scheduled redemption expiry failed', error);
    return NextResponse.json(
      { error: 'Expiry job failed.' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
