import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getStudentData } from '@/lib/services/points';
import { Navbar } from '@/components/Navbar';
import { AdminDashboard } from '@/components/AdminDashboard';
import { TeacherDashboard } from '@/components/TeacherDashboard';
import { StudentDashboard } from '@/components/StudentDashboard';

export default async function DashboardPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect('/login');
  }

  const isDemoMode = process.env.DEMO_MODE === 'true';

  if (session.role === 'ADMIN') {
    // 1. Fetch Teachers
    const teachers = await prisma.user.findMany({
      where: { role: 'TEACHER' },
      include: {
        taughtClasses: {
          include: {
            _count: { select: { students: true } },
          },
        },
        _count: {
          select: { givenAwards: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 2. Fetch Rewards
    const rewards = await prisma.reward.findMany({
      include: {
        _count: { select: { redemptions: true } },
      },
      orderBy: { pointCost: 'asc' },
    });

    // 3. Fetch Redemptions
    const redemptions = await prisma.redemption.findMany({
      include: {
        student: { select: { id: true, name: true, username: true } },
        reward: { select: { id: true, name: true, emoji: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 4. Fetch Stats
    const totalPointsAwardedSum = await prisma.pointLedger.aggregate({
      _sum: { amount: true },
      where: { type: 'AWARD' },
    });

    const totalStudents = await prisma.user.count({ where: { role: 'STUDENT' } });

    const stats = {
      totalPointsAwarded: totalPointsAwardedSum._sum.amount ?? 0,
      totalRedemptions: redemptions.length,
      totalStudents,
      totalTeachers: teachers.length,
    };

    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar user={session} demoMode={isDemoMode} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <AdminDashboard
            teachers={teachers as any}
            rewards={rewards}
            redemptions={redemptions}
            stats={stats}
          />
        </main>
      </div>
    );
  }

  if (session.role === 'TEACHER') {
    const teacher = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        taughtClasses: {
          include: {
            students: {
              select: {
                id: true,
                name: true,
                username: true,
                ledgerEntries: {
                  select: { amount: true },
                },
              },
            },
          },
        },
      },
    });

    if (!teacher) {
      redirect('/login');
    }

    // Format classes with computed balance for each student
    const formattedClasses = teacher.taughtClasses.map((cls) => ({
      id: cls.id,
      name: cls.name,
      students: cls.students.map((st) => ({
        id: st.id,
        name: st.name,
        username: st.username,
        balance: st.ledgerEntries.reduce((acc, curr) => acc + curr.amount, 0),
      })),
    }));

    // Calculate points awarded today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const awardsToday = await prisma.pointLedger.aggregate({
      _sum: { amount: true },
      where: {
        awardedById: teacher.id,
        type: 'AWARD',
        createdAt: { gte: todayStart },
      },
    });

    const pointsAwardedToday = awardsToday._sum.amount ?? 0;

    // Recent awards by this teacher
    const recentAwards = await prisma.pointLedger.findMany({
      where: {
        awardedById: teacher.id,
        type: 'AWARD',
      },
      include: {
        student: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar user={session} demoMode={isDemoMode} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <TeacherDashboard
            teacher={{
              id: teacher.id,
              name: teacher.name,
              username: teacher.username,
              teacherStatus: (teacher.teacherStatus as any) || 'PENDING',
              dailyAwardLimit: teacher.dailyAwardLimit ?? 50,
            }}
            classes={formattedClasses}
            pointsAwardedToday={pointsAwardedToday}
            recentAwards={recentAwards}
          />
        </main>
      </div>
    );
  }

  if (session.role === 'STUDENT') {
    const data = await getStudentData({
      currentUserId: session.userId,
      currentUserRole: session.role,
      targetStudentId: session.userId,
    });

    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar user={session} demoMode={isDemoMode} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <StudentDashboard
            student={data.student}
            balance={data.balance}
            ledger={data.ledger}
            redemptions={data.redemptions}
            rewards={data.rewards}
          />
        </main>
      </div>
    );
  }

  redirect('/login');
}
