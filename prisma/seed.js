const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.pointLedger.deleteMany();
  await prisma.redemption.deleteMany();
  await prisma.reward.deleteMany();
  await prisma.classroom.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Admin
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash,
      name: 'Principal Vance',
      role: 'ADMIN',
    },
  });

  // 2. Teachers (one approved, one pending)
  const approvedTeacher = await prisma.user.create({
    data: {
      username: 'teacher_sarah',
      passwordHash,
      name: 'Ms. Sarah Connor',
      role: 'TEACHER',
      teacherStatus: 'APPROVED',
      dailyAwardLimit: 60,
    },
  });

  const pendingTeacher = await prisma.user.create({
    data: {
      username: 'teacher_john',
      passwordHash,
      name: 'Mr. John Keating',
      role: 'TEACHER',
      teacherStatus: 'PENDING',
      dailyAwardLimit: 50,
    },
  });

  // 3. Classrooms
  const classA = await prisma.classroom.create({
    data: {
      name: 'Room 5A - Science Explorers',
      teacherId: approvedTeacher.id,
    },
  });

  const classB = await prisma.classroom.create({
    data: {
      name: 'Room 5B - Creative Arts',
      teacherId: pendingTeacher.id,
    },
  });

  // 4. 10 Students in 2 classes
  const studentsClassA = [
    { username: 'student_alice', name: 'Alice Walker' },
    { username: 'student_bob', name: 'Bob Smith' },
    { username: 'student_charlie', name: 'Charlie Brown' },
    { username: 'student_daisy', name: 'Daisy Ridley' },
    { username: 'student_ethan', name: 'Ethan Hunt' },
  ];

  const studentsClassB = [
    { username: 'student_fiona', name: 'Fiona Gallagher' },
    { username: 'student_george', name: 'George Miller' },
    { username: 'student_hannah', name: 'Hannah Abbott' },
    { username: 'student_ian', name: 'Ian Malcolm' },
    { username: 'student_julia', name: 'Julia Roberts' },
  ];

  const createdClassAStudents = [];
  for (const s of studentsClassA) {
    const student = await prisma.user.create({
      data: {
        username: s.username,
        passwordHash,
        name: s.name,
        role: 'STUDENT',
        classroomId: classA.id,
      },
    });
    createdClassAStudents.push(student);
  }

  for (const s of studentsClassB) {
    await prisma.user.create({
      data: {
        username: s.username,
        passwordHash,
        name: s.name,
        role: 'STUDENT',
        classroomId: classB.id,
      },
    });
  }

  // 5. 8 School Supply Rewards (emoji icons, no image uploads)
  const rewardsData = [
    { name: 'Funky Eraser Top', emoji: '✏️', pointCost: 5, stock: 25 },
    { name: 'Flexi Bendable Ruler', emoji: '📏', pointCost: 10, stock: 20 },
    { name: 'Neon Gel Pen Set', emoji: '🖊️', pointCost: 15, stock: 12 },
    { name: 'Glow-in-the-Dark Notebook', emoji: '📓', pointCost: 25, stock: 8 },
    { name: '24-Color Pastel Markers', emoji: '🎨', pointCost: 35, stock: 5 },
    { name: 'School Mascot Keychain', emoji: '🎒', pointCost: 50, stock: 4 },
    { name: 'Classroom DJ Pass', emoji: '🎧', pointCost: 75, stock: 2 },
    { name: 'Principal for 1 Hour', emoji: '🏆', pointCost: 100, stock: 1 },
  ];

  const createdRewards = [];
  for (const r of rewardsData) {
    const reward = await prisma.reward.create({ data: r });
    createdRewards.push(reward);
  }

  // 6. Sample ledger history to make dashboards alive
  // Give Alice points and a redemption
  const alice = createdClassAStudents[0];
  const bob = createdClassAStudents[1];
  const charlie = createdClassAStudents[2];

  // Alice points
  await prisma.pointLedger.create({
    data: {
      studentId: alice.id,
      amount: 10,
      type: 'AWARD',
      category: 'HOMEWORK',
      note: 'Outstanding math assignment',
      awardedById: approvedTeacher.id,
      createdAt: new Date(Date.now() - 48 * 3600 * 1000),
    },
  });

  await prisma.pointLedger.create({
    data: {
      studentId: alice.id,
      amount: 15,
      type: 'AWARD',
      category: 'IMPROVEMENT',
      note: 'Terrific improvement in science lab',
      awardedById: approvedTeacher.id,
      createdAt: new Date(Date.now() - 24 * 3600 * 1000),
    },
  });

  await prisma.pointLedger.create({
    data: {
      studentId: alice.id,
      amount: 10,
      type: 'AWARD',
      category: 'KINDNESS',
      note: 'Helped clean up the lab stations',
      awardedById: approvedTeacher.id,
      createdAt: new Date(Date.now() - 2 * 3600 * 1000),
    },
  });

  // Alice redeemed a Gel Pen Set (15 pts) - status READY
  const gelPenReward = createdRewards[2];
  const aliceRedemption = await prisma.redemption.create({
    data: {
      studentId: alice.id,
      rewardId: gelPenReward.id,
      pointCost: gelPenReward.pointCost,
      status: 'READY',
      createdAt: new Date(Date.now() - 5 * 3600 * 1000),
    },
  });

  // Alice redemption ledger item
  await prisma.pointLedger.create({
    data: {
      studentId: alice.id,
      amount: -gelPenReward.pointCost,
      type: 'REDEMPTION',
      redemptionId: aliceRedemption.id,
      note: `Redeemed ${gelPenReward.name}`,
      createdAt: new Date(Date.now() - 5 * 3600 * 1000),
    },
  });

  // Decrement stock for Alice's redemption
  await prisma.reward.update({
    where: { id: gelPenReward.id },
    data: { stock: { decrement: 1 } },
  });

  // Bob points and Requested redemption
  await prisma.pointLedger.create({
    data: {
      studentId: bob.id,
      amount: 15,
      type: 'AWARD',
      category: 'PARTICIPATION',
      note: 'Great questions during history talk',
      awardedById: approvedTeacher.id,
      createdAt: new Date(Date.now() - 12 * 3600 * 1000),
    },
  });

  // Charlie points
  await prisma.pointLedger.create({
    data: {
      studentId: charlie.id,
      amount: 20,
      type: 'AWARD',
      category: 'HOMEWORK',
      note: 'Perfect reading log',
      awardedById: approvedTeacher.id,
      createdAt: new Date(Date.now() - 6 * 3600 * 1000),
    },
  });

  console.log('Seed completed successfully!');
  console.log('Users created:');
  console.log('- Admin: admin (password: password123)');
  console.log('- Approved Teacher: teacher_sarah (password: password123)');
  console.log('- Pending Teacher: teacher_john (password: password123)');
  console.log('- Students: student_alice ... student_julia (password: password123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
