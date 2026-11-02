import { prisma } from '../prisma';
import { AwardCategory, RedemptionStatus } from '../types';

export async function getStudentBalance(studentId: string): Promise<number> {
  const result = await prisma.pointLedger.aggregate({
    _sum: { amount: true },
    where: { studentId },
  });
  return result._sum.amount ?? 0;
}

export async function awardPoints(params: {
  teacherId: string;
  studentId: string;
  amount: number;
  category: AwardCategory;
  note?: string;
}) {
  const { teacherId, studentId, amount, category, note } = params;

  if (amount <= 0 || !Number.isInteger(amount)) {
    throw new Error('INVALID_AMOUNT: Award amount must be a positive integer');
  }

  // Verify teacher
  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    include: { taughtClasses: true },
  });

  if (!teacher || teacher.role !== 'TEACHER') {
    throw new Error('TEACHER_NOT_FOUND: Invalid teacher');
  }

  if (teacher.teacherStatus !== 'APPROVED') {
    throw new Error('TEACHER_NOT_APPROVED: Teacher must be approved by an administrator to award points');
  }

  // Verify student & classroom
  const student = await prisma.user.findUnique({
    where: { id: studentId },
  });

  if (!student || student.role !== 'STUDENT') {
    throw new Error('STUDENT_NOT_FOUND: Invalid student');
  }

  const teacherClassIds = teacher.taughtClasses.map((c) => c.id);
  if (!student.classroomId || !teacherClassIds.includes(student.classroomId)) {
    throw new Error('STUDENT_NOT_IN_TEACHER_CLASS: Teachers can only award points to students in their own classes');
  }

  // Verify daily award limit
  const dailyLimit = teacher.dailyAwardLimit ?? 50;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const awardsToday = await prisma.pointLedger.aggregate({
    _sum: { amount: true },
    where: {
      awardedById: teacherId,
      type: 'AWARD',
      createdAt: { gte: todayStart },
    },
  });

  const pointsAwardedToday = awardsToday._sum.amount ?? 0;
  if (pointsAwardedToday + amount > dailyLimit) {
    throw new Error(
      `DAILY_LIMIT_EXCEEDED: You have awarded ${pointsAwardedToday} of your daily ${dailyLimit} points limit. Cannot award ${amount} more.`
    );
  }

  // Create append-only ledger entry
  const entry = await prisma.pointLedger.create({
    data: {
      studentId,
      amount,
      type: 'AWARD',
      category,
      note: note?.trim() || null,
      awardedById: teacherId,
    },
  });

  return entry;
}

export async function redeemReward(params: { studentId: string; rewardId: string }) {
  const { studentId, rewardId } = params;

  return await prisma.$transaction(async (tx) => {
    // 1. Verify student
    const student = await tx.user.findUnique({ where: { id: studentId } });
    if (!student || student.role !== 'STUDENT') {
      throw new Error('STUDENT_NOT_FOUND');
    }

    // 2. Lock / Fetch reward
    const reward = await tx.reward.findUnique({ where: { id: rewardId } });
    if (!reward || !reward.active) {
      throw new Error('REWARD_NOT_FOUND: The requested reward does not exist or is inactive');
    }

    // 3. Check stock
    if (reward.stock < 1) {
      throw new Error('OUT_OF_STOCK: This item is currently out of stock');
    }

    // 4. Check student balance
    const sumResult = await tx.pointLedger.aggregate({
      _sum: { amount: true },
      where: { studentId },
    });
    const currentBalance = sumResult._sum.amount ?? 0;

    if (currentBalance < reward.pointCost) {
      throw new Error(
        `INSUFFICIENT_BALANCE: You need ${reward.pointCost} points but currently have ${currentBalance} points`
      );
    }

    // 5. Decrement stock
    await tx.reward.update({
      where: { id: rewardId },
      data: { stock: { decrement: 1 } },
    });

    // 6. Create redemption record
    const redemption = await tx.redemption.create({
      data: {
        studentId,
        rewardId,
        pointCost: reward.pointCost,
        status: 'REQUESTED',
      },
    });

    // 7. Append negative points entry to ledger
    await tx.pointLedger.create({
      data: {
        studentId,
        amount: -reward.pointCost,
        type: 'REDEMPTION',
        redemptionId: redemption.id,
        note: `Redeemed ${reward.name}`,
      },
    });

    return redemption;
  });
}

export async function cancelRedemption(redemptionId: string) {
  return await prisma.$transaction(async (tx) => {
    const redemption = await tx.redemption.findUnique({
      where: { id: redemptionId },
      include: { reward: true },
    });

    if (!redemption) {
      throw new Error('REDEMPTION_NOT_FOUND');
    }

    if (redemption.status === 'CANCELLED') {
      throw new Error('ALREADY_CANCELLED: This redemption has already been cancelled');
    }

    if (redemption.status === 'COLLECTED') {
      throw new Error('CANNOT_CANCEL_COLLECTED: Item has already been collected');
    }

    // Update status
    const updated = await tx.redemption.update({
      where: { id: redemptionId },
      data: { status: 'CANCELLED' },
    });

    // Restore stock
    await tx.reward.update({
      where: { id: redemption.rewardId },
      data: { stock: { increment: 1 } },
    });

    // Refund points to append-only ledger
    await tx.pointLedger.create({
      data: {
        studentId: redemption.studentId,
        amount: redemption.pointCost,
        type: 'REFUND',
        redemptionId: redemption.id,
        note: `Refund for cancelled redemption: ${redemption.reward.name}`,
      },
    });

    return updated;
  });
}

export async function updateRedemptionStatus(
  redemptionId: string,
  newStatus: RedemptionStatus
) {
  if (newStatus === 'CANCELLED') {
    return cancelRedemption(redemptionId);
  }

  return await prisma.redemption.update({
    where: { id: redemptionId },
    data: { status: newStatus },
  });
}

export async function getStudentData(params: {
  currentUserId: string;
  currentUserRole: string;
  targetStudentId: string;
}) {
  const { currentUserId, currentUserRole, targetStudentId } = params;

  if (currentUserRole === 'STUDENT' && currentUserId !== targetStudentId) {
    throw new Error('FORBIDDEN_STUDENT_ACCESS: Students can only view their own data');
  }

  const student = await prisma.user.findUnique({
    where: { id: targetStudentId },
    include: {
      classroom: true,
      ledgerEntries: {
        orderBy: { createdAt: 'desc' },
        include: {
          awardedBy: { select: { id: true, name: true } },
        },
      },
      redemptions: {
        orderBy: { createdAt: 'desc' },
        include: { reward: true },
      },
    },
  });

  if (!student || student.role !== 'STUDENT') {
    throw new Error('STUDENT_NOT_FOUND');
  }

  const balance = student.ledgerEntries.reduce((acc, curr) => acc + curr.amount, 0);

  const rewards = await prisma.reward.findMany({
    where: { active: true },
    orderBy: { pointCost: 'asc' },
  });

  return {
    student: {
      id: student.id,
      name: student.name,
      username: student.username,
      classroom: student.classroom,
    },
    balance,
    ledger: student.ledgerEntries,
    redemptions: student.redemptions,
    rewards,
  };
}
