import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import {
  awardPoints,
  redeemReward,
  getStudentData,
  cancelRedemption,
  updateRedemptionStatus,
  expireOverdueRedemptions,
} from '../src/lib/services/points';

describe('SchoolPoints business logic and security rules', () => {
  let admin: any;
  let teacher: any;
  let pendingTeacher: any;
  let teacherB: any;
  let classA: any;
  let classB: any;
  let alice: any;
  let bob: any;
  let fiona: any;
  let charlie: any;
  let concurrentA: any;
  let concurrentB: any;
  let lastItem: any;
  let expensiveReward: any;
  let stateReward: any;
  let cancelReward: any;
  let expiryReward: any;
  let concurrentReward: any;

  async function createStudent(username: string, name: string, classroomId: string) {
    return prisma.user.create({
      data: {
        username,
        passwordHash: 'not-used-in-service-tests',
        name,
        role: 'STUDENT',
        status: 'ACTIVE',
        classroomId,
      },
    });
  }

  async function grantPoints(studentId: string, amount: number) {
    return prisma.pointLedger.create({
      data: {
        studentId,
        amount,
        type: 'AWARD',
        category: 'HOMEWORK',
        note: 'Test fixture grant',
        awardedById: teacher.id,
        // Use yesterday so the fixture does not consume today's student cap.
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });
  }

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.dispute.deleteMany();
    await prisma.idempotencyKey.deleteMany();
    await prisma.job.deleteMany();
    await prisma.rateLimitBucket.deleteMany();
    await prisma.pointLedger.deleteMany();
    await prisma.redemption.deleteMany();
    await prisma.reward.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.monthlyAllocation.deleteMany();
    await prisma.pointPolicy.deleteMany();
    await prisma.user.deleteMany();
    await prisma.classroom.deleteMany();

    admin = await prisma.user.create({
      data: {
        username: 'test_admin',
        passwordHash: 'not-used-in-service-tests',
        name: 'Test Administrator',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    teacher = await prisma.user.create({
      data: {
        username: 'test_teacher_a',
        passwordHash: 'not-used-in-service-tests',
        name: 'Test Teacher A',
        role: 'TEACHER',
        status: 'ACTIVE',
        teacherStatus: 'APPROVED',
        dailyAwardLimit: 60,
        approvedById: admin.id,
        approvedAt: new Date(),
      },
    });

    pendingTeacher = await prisma.user.create({
      data: {
        username: 'test_teacher_pending',
        passwordHash: 'not-used-in-service-tests',
        name: 'Test Pending Teacher',
        role: 'TEACHER',
        status: 'ACTIVE',
        teacherStatus: 'PENDING',
        dailyAwardLimit: 50,
      },
    });

    teacherB = await prisma.user.create({
      data: {
        username: 'test_teacher_b',
        passwordHash: 'not-used-in-service-tests',
        name: 'Test Teacher B',
        role: 'TEACHER',
        status: 'ACTIVE',
        teacherStatus: 'APPROVED',
        dailyAwardLimit: 60,
        approvedById: admin.id,
        approvedAt: new Date(),
      },
    });

    classA = await prisma.classroom.create({
      data: { name: 'Test Room A', teacherId: teacher.id },
    });
    classB = await prisma.classroom.create({
      data: { name: 'Test Room B', teacherId: teacherB.id },
    });

    alice = await createStudent('test_alice', 'Alice Test', classA.id);
    bob = await createStudent('test_bob', 'Bob Test', classA.id);
    fiona = await createStudent('test_fiona', 'Fiona Test', classB.id);
    charlie = await createStudent('test_charlie', 'Charlie Test', classA.id);
    concurrentA = await createStudent('test_concurrent_a', 'Concurrent A', classA.id);
    concurrentB = await createStudent('test_concurrent_b', 'Concurrent B', classA.id);

    await grantPoints(alice.id, 50);
    await grantPoints(concurrentA.id, 20);
    await grantPoints(concurrentB.id, 20);

    lastItem = await prisma.reward.create({
      data: { name: 'Test Last Item', emoji: '✏️', pointCost: 5, stock: 1 },
    });
    expensiveReward = await prisma.reward.create({
      data: { name: 'Test Expensive Item', emoji: '🎁', pointCost: 100, stock: 5 },
    });
    stateReward = await prisma.reward.create({
      data: { name: 'Test State Item', emoji: '📓', pointCost: 5, stock: 5 },
    });
    cancelReward = await prisma.reward.create({
      data: { name: 'Test Cancel Item', emoji: '📏', pointCost: 5, stock: 2 },
    });
    expiryReward = await prisma.reward.create({
      data: { name: 'Test Expiry Item', emoji: '🖊️', pointCost: 5, stock: 2 },
    });
    concurrentReward = await prisma.reward.create({
      data: { name: 'Test Concurrent Item', emoji: '🎒', pointCost: 5, stock: 1 },
    });
  });

  afterAll(async () => {
    // The points ledger is intentionally append-only at the database level.
    // Temporarily remove that protection so the disposable test database can
    // be cleaned up; the next test run recreates it from migrations.
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS point_ledger_no_delete');
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS point_ledger_no_update');

    await prisma.auditLog.deleteMany();
    await prisma.dispute.deleteMany();
    await prisma.idempotencyKey.deleteMany();
    await prisma.job.deleteMany();
    await prisma.rateLimitBucket.deleteMany();
    await prisma.pointLedger.deleteMany();
    await prisma.redemption.deleteMany();
    await prisma.reward.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.monthlyAllocation.deleteMany();
    await prisma.pointPolicy.deleteMany();
    await prisma.user.deleteMany();
    await prisma.classroom.deleteMany();
    await prisma.$disconnect();
  });

  it('1. rejects awards from a pending teacher', async () => {
    await expect(
      awardPoints({
        teacherId: pendingTeacher.id,
        studentId: alice.id,
        amount: 5,
        category: 'HOMEWORK',
      })
    ).rejects.toThrow(/TEACHER_NOT_APPROVED/);
  });

  it('2. rejects awards to a student outside the teacher class', async () => {
    await expect(
      awardPoints({
        teacherId: teacher.id,
        studentId: fiona.id,
        amount: 5,
        category: 'PARTICIPATION',
      })
    ).rejects.toThrow(/STUDENT_NOT_IN_TEACHER_CLASS/);
  });

  it('3. rejects over-redemption without changing stock', async () => {
    await expect(
      redeemReward({ studentId: fiona.id, rewardId: expensiveReward.id })
    ).rejects.toThrow(/INSUFFICIENT_BALANCE/);

    const unchanged = await prisma.reward.findUnique({ where: { id: expensiveReward.id } });
    expect(unchanged!.stock).toBe(5);
  });

  it('4. prevents students and unrelated teachers from reading another student', async () => {
    await expect(
      getStudentData({
        currentUserId: alice.id,
        currentUserRole: 'STUDENT',
        targetStudentId: bob.id,
      })
    ).rejects.toThrow(/FORBIDDEN_STUDENT_ACCESS/);

    await expect(
      getStudentData({
        currentUserId: teacherB.id,
        currentUserRole: 'TEACHER',
        targetStudentId: alice.id,
      })
    ).rejects.toThrow(/FORBIDDEN_STUDENT_ACCESS/);
  });

  it('5. redeeming the last item twice succeeds only once', async () => {
    const first = await redeemReward({ studentId: alice.id, rewardId: lastItem.id });
    expect(first.status).toBe('REQUESTED');
    expect(first.expiresAt).toBeTruthy();

    await expect(
      redeemReward({ studentId: alice.id, rewardId: lastItem.id })
    ).rejects.toThrow(/OUT_OF_STOCK/);

    const updated = await prisma.reward.findUnique({ where: { id: lastItem.id } });
    expect(updated!.stock).toBe(0);
  });

  it('6. rejects an unapproved award category on the server', async () => {
    await expect(
      awardPoints({
        teacherId: teacher.id,
        studentId: charlie.id,
        amount: 5,
        category: 'BONUS' as any,
      })
    ).rejects.toThrow(/INVALID_CATEGORY/);
  });

  it('7. rejects a single award above the 10-point ceiling', async () => {
    await expect(
      awardPoints({
        teacherId: teacher.id,
        studentId: charlie.id,
        amount: 11,
        category: 'HOMEWORK',
      })
    ).rejects.toThrow(/AWARD_LIMIT_EXCEEDED/);
  });

  it('8. enforces the 20-point student daily ceiling across awards', async () => {
    await awardPoints({
      teacherId: teacher.id,
      studentId: charlie.id,
      amount: 10,
      category: 'HOMEWORK',
    });
    await awardPoints({
      teacherId: teacher.id,
      studentId: charlie.id,
      amount: 10,
      category: 'PARTICIPATION',
    });

    await expect(
      awardPoints({
        teacherId: teacher.id,
        studentId: charlie.id,
        amount: 1,
        category: 'IMPROVEMENT',
      })
    ).rejects.toThrow(/STUDENT_DAILY_LIMIT_EXCEEDED/);

    const today = await prisma.pointLedger.aggregate({
      _sum: { amount: true },
      where: { studentId: charlie.id, type: 'AWARD' },
    });
    expect(today._sum.amount).toBe(20);
  });

  it('9. enforces the redemption state machine and records the collector', async () => {
    const redemption = await redeemReward({
      studentId: alice.id,
      rewardId: stateReward.id,
    });

    await expect(
      updateRedemptionStatus(redemption.id, 'COLLECTED', { actorId: admin.id })
    ).rejects.toThrow(/INVALID_TRANSITION/);

    const ready = await updateRedemptionStatus(redemption.id, 'READY', {
      actorId: admin.id,
    });
    expect(ready.status).toBe('READY');
    expect(ready.readyAt).toBeTruthy();

    await expect(
      updateRedemptionStatus(redemption.id, 'READY', { actorId: admin.id })
    ).rejects.toThrow(/INVALID_TRANSITION/);

    const collected = await updateRedemptionStatus(redemption.id, 'COLLECTED', {
      actorId: admin.id,
    });
    expect(collected.status).toBe('COLLECTED');
    expect(collected.collectedById).toBe(admin.id);
    expect(collected.collectedAt).toBeTruthy();

    await expect(
      updateRedemptionStatus(redemption.id, 'COLLECTED', { actorId: admin.id })
    ).rejects.toThrow(/INVALID_TRANSITION/);
  });

  it('10. cancels once, refunds once, and restores stock once', async () => {
    const redemption = await redeemReward({
      studentId: alice.id,
      rewardId: cancelReward.id,
    });

    const cancelled = await cancelRedemption(redemption.id, {
      actorId: alice.id,
      studentId: alice.id,
      status: 'CANCELLED',
    });
    expect(cancelled.status).toBe('CANCELLED');

    await expect(
      cancelRedemption(redemption.id, {
        actorId: alice.id,
        studentId: alice.id,
        status: 'CANCELLED',
      })
    ).rejects.toThrow(/ALREADY_CANCELLED/);

    const refunds = await prisma.pointLedger.count({
      where: { redemptionId: redemption.id, type: 'REFUND' },
    });
    expect(refunds).toBe(1);

    const reward = await prisma.reward.findUnique({ where: { id: cancelReward.id } });
    expect(reward!.stock).toBe(2);

    const auditEvents = await prisma.auditLog.count({
      where: { action: 'REDEMPTION_CANCELLED', entityId: redemption.id },
    });
    expect(auditEvents).toBe(1);
  });

  it('11. refuses collection after expiry and refunds the request', async () => {
    const redemption = await redeemReward({
      studentId: alice.id,
      rewardId: expiryReward.id,
    });

    await prisma.redemption.update({
      where: { id: redemption.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(
      updateRedemptionStatus(redemption.id, 'COLLECTED', { actorId: admin.id })
    ).rejects.toThrow(/REDEMPTION_EXPIRED/);

    const expired = await prisma.redemption.findUnique({ where: { id: redemption.id } });
    expect(expired!.status).toBe('EXPIRED');

    const refunds = await prisma.pointLedger.count({
      where: { redemptionId: redemption.id, type: 'REFUND' },
    });
    expect(refunds).toBe(1);

    const reward = await prisma.reward.findUnique({ where: { id: expiryReward.id } });
    expect(reward!.stock).toBe(2);
  });

  it('12. expires overdue requests in one consistent pass', async () => {
    const redemption = await redeemReward({
      studentId: concurrentA.id,
      rewardId: expiryReward.id,
    });

    await prisma.redemption.update({
      where: { id: redemption.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const expiredCount = await expireOverdueRedemptions();
    expect(expiredCount).toBeGreaterThanOrEqual(1);

    const expired = await prisma.redemption.findUnique({ where: { id: redemption.id } });
    expect(expired!.status).toBe('EXPIRED');
  });

  it('13. allows at most one concurrent request for the final item', async () => {
    const results = await Promise.allSettled([
      redeemReward({ studentId: concurrentA.id, rewardId: concurrentReward.id }),
      redeemReward({ studentId: concurrentB.id, rewardId: concurrentReward.id }),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    expect(fulfilled.length).toBe(1);

    const reward = await prisma.reward.findUnique({ where: { id: concurrentReward.id } });
    expect(reward!.stock).toBe(0);

    const requests = await prisma.redemption.count({
      where: { rewardId: concurrentReward.id },
    });
    expect(requests).toBe(1);
  });

  it('14. cannot double-spend the same balance across two rewards', async () => {
    const spender = await createStudent('test_spender', 'Spender Test', classA.id);
    await prisma.pointLedger.create({
      data: {
        studentId: spender.id,
        amount: 20,
        type: 'AWARD',
        category: 'HOMEWORK',
        awardedById: teacher.id,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    const rewardA = await prisma.reward.create({
      data: { name: 'Test Race Item A', emoji: '🅰️', pointCost: 20, stock: 1 },
    });
    const rewardB = await prisma.reward.create({
      data: { name: 'Test Race Item B', emoji: '🅱️', pointCost: 20, stock: 1 },
    });

    const results = await Promise.allSettled([
      redeemReward({ studentId: spender.id, rewardId: rewardA.id }),
      redeemReward({ studentId: spender.id, rewardId: rewardB.id }),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    expect(fulfilled.length).toBe(1);

    const balance = await prisma.pointLedger.aggregate({
      _sum: { amount: true },
      where: { studentId: spender.id },
    });
    expect(balance._sum.amount).toBe(0);
  });
});
