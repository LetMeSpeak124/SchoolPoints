import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\r\n');
}

export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const dataset = request.nextUrl.searchParams.get('dataset') || 'students';

  if (dataset === 'students') {
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      include: { classroom: true, ledgerEntries: { select: { amount: true } } },
      orderBy: { name: 'asc' },
    });

    const rows = students.map((student) => [
      student.id,
      student.username,
      student.name,
      student.status,
      student.classroom?.name ?? '',
      student.ledgerEntries.reduce((total, entry) => total + entry.amount, 0),
    ]);

    const csv = toCsv(['id', 'username', 'name', 'status', 'classroom', 'balance'], rows);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="students.csv"',
        'Cache-Control': 'no-store',
      },
    });
  }

  if (dataset === 'ledger') {
    const entries = await prisma.pointLedger.findMany({
      include: {
        student: { select: { username: true, name: true } },
        awardedBy: { select: { username: true, name: true } },
        redemption: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const rows = entries.map((entry) => [
      entry.id,
      entry.createdAt.toISOString(),
      entry.student.username,
      entry.student.name,
      entry.type,
      entry.category ?? '',
      entry.amount,
      entry.awardedBy?.username ?? '',
      entry.redemption?.id ?? '',
      entry.note ?? '',
    ]);

    const csv = toCsv(
      ['id', 'createdAt', 'studentUsername', 'studentName', 'type', 'category', 'amount', 'awardedBy', 'redemptionId', 'note'],
      rows
    );
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="points-ledger.csv"',
        'Cache-Control': 'no-store',
      },
    });
  }

  if (dataset === 'redemptions') {
    const redemptions = await prisma.redemption.findMany({
      include: {
        student: { select: { username: true, name: true } },
        reward: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = redemptions.map((redemption) => [
      redemption.id,
      redemption.createdAt.toISOString(),
      redemption.student.username,
      redemption.student.name,
      redemption.reward.name,
      redemption.pointCost,
      redemption.status,
      redemption.expiresAt?.toISOString() ?? '',
      redemption.collectedAt?.toISOString() ?? '',
      redemption.cancelledAt?.toISOString() ?? '',
    ]);

    const csv = toCsv(
      ['id', 'createdAt', 'studentUsername', 'studentName', 'reward', 'pointCost', 'status', 'expiresAt', 'collectedAt', 'cancelledAt'],
      rows
    );
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="redemptions.csv"',
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.json({ error: 'Unknown dataset' }, { status: 400 });
}