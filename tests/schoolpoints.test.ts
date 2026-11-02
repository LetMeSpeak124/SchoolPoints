import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { awardPoints, redeemReward, getStudentData } from '../src/lib/services/points';

describe('SchoolPoints Business Logic & Security Rules', () => {
  let approvedTeacher: any;
  let pendingTeacher: any;
  let classAStudent: any;
  let classBStudent: any;
  let testReward: any;

  beforeAll(async () => {
    // Fetch users created by seed or create test fixture
    approvedTeacher = await prisma.user.findUnique({ where: { username: 'teacher_sarah' } });
    pendingTeacher = await prisma.user.findUnique({ where: { username: 'teacher_john' } });
    classAStudent = await prisma.user.findUnique({ where: { username: 'student_alice' } });
    classBStudent = await prisma.user.findUnique({ where: { username: 'student_fiona' } });

    // Create a limited test reward with stock = 1
    testReward = await prisma.reward.create({
      data: {
        name: 'Rare Golden Pencil',
        emoji: '✏️',
        pointCost: 5,
        stock: 1,
      },
    });

    // Ensure classAStudent has ample points for testing
    await prisma.pointLedger.create({
      data: {
        studentId: classAStudent.id,
        amount: 50,
        type: 'AWARD',
        category: 'IMPROVEMENT',
        note: 'Test grant points',
        awardedById: approvedTeacher.id,
      },
    });
  });

  afterAll(async () => {
    // Cleanup any created test-specific reward
    if (testReward?.id) {
      await prisma.pointLedger.deleteMany({ where: { redemption: { rewardId: testReward.id } } });
      await prisma.redemption.deleteMany({ where: { rewardId: testReward.id } });
      await prisma.reward.delete({ where: { id: testReward.id } }).catch(() => {});
    }
  });

  // 1. Pending teacher can't award
  it('1. Pending teacher cannot award points', async () => {
    await expect(
      awardPoints({
        teacherId: pendingTeacher.id,
        studentId: classBStudent.id,
        amount: 5,
        category: 'HOMEWORK',
        note: 'Attempt from pending teacher',
      })
    ).rejects.toThrow(/TEACHER_NOT_APPROVED/);
  });

  // 2. Teacher can't award outside their class
  it('2. Teacher cannot award points to a student outside their own class', async () => {
    // approvedTeacher teaches Room 5A, but classBStudent is in Room 5B
    await expect(
      awardPoints({
        teacherId: approvedTeacher.id,
        studentId: classBStudent.id,
        amount: 5,
        category: 'PARTICIPATION',
        note: 'Cross-class attempt',
      })
    ).rejects.toThrow(/STUDENT_NOT_IN_TEACHER_CLASS/);
  });

  // 3. Over-redemption fails
  it('3. Over-redemption fails when student does not have enough points', async () => {
    // Find a reward costing more than student's balance or test with zero-balance student
    const expensiveReward = await prisma.reward.findFirst({
      where: { pointCost: { gte: 100 } },
    });
    expect(expensiveReward).toBeDefined();

    // classBStudent has 0 points
    await expect(
      redeemReward({
        studentId: classBStudent.id,
        rewardId: expensiveReward!.id,
      })
    ).rejects.toThrow(/INSUFFICIENT_BALANCE/);
  });

  // 4. Student can't read another student's data
  it('4. Student cannot read another student data', async () => {
    // Alice trying to read Bob's data
    const bob = await prisma.user.findUnique({ where: { username: 'student_bob' } });
    expect(bob).toBeDefined();

    await expect(
      getStudentData({
        currentUserId: classAStudent.id,
        currentUserRole: 'STUDENT',
        targetStudentId: bob!.id,
      })
    ).rejects.toThrow(/FORBIDDEN_STUDENT_ACCESS/);
  });

  // 5. Redeeming the last item twice succeeds only once
  it('5. Redeeming the last item twice succeeds only once', async () => {
    // testReward has stock: 1
    // First redemption succeeds
    const firstRedemption = await redeemReward({
      studentId: classAStudent.id,
      rewardId: testReward.id,
    });
    expect(firstRedemption).toBeDefined();
    expect(firstRedemption.rewardId).toBe(testReward.id);

    // Second redemption must fail due to out of stock
    await expect(
      redeemReward({
        studentId: classAStudent.id,
        rewardId: testReward.id,
      })
    ).rejects.toThrow(/OUT_OF_STOCK/);

    // Verify stock is now 0
    const updatedReward = await prisma.reward.findUnique({ where: { id: testReward.id } });
    expect(updatedReward!.stock).toBe(0);
  });
});
