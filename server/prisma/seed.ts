import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting seed...');

  // Clean up existing data
  await prisma.review.deleteMany();
  await prisma.message.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.session.deleteMany();
  await prisma.userSkill.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.user.deleteMany();

  // Create Core Skills
  const react = await prisma.skill.create({ data: { name: 'React', category: 'Software & AI' } });
  const python = await prisma.skill.create({ data: { name: 'Python', category: 'Software & AI' } });
  const uiDesign = await prisma.skill.create({ data: { name: 'UI Design', category: 'Design & 3D' } });
  const figma = await prisma.skill.create({ data: { name: 'Figma', category: 'Design & 3D' } });
  const java = await prisma.skill.create({ data: { name: 'Java', category: 'Software & AI' } });
  const springBoot = await prisma.skill.create({ data: { name: 'Spring Boot', category: 'Software & AI' } });

  // 1. Student Profile: Alex
  const alex = await prisma.user.create({
    data: {
      name: 'Alex (Student)',
      role: 'student',
      tokenBalance: 50,
      trustScore: 4.95,
      userSkills: {
        create: [
          { skillId: react.id, type: 'teaches' },
          { skillId: python.id, type: 'wants_to_learn' },
          { skillId: uiDesign.id, type: 'wants_to_learn' }
        ]
      }
    }
  });

  // 2. Teacher Profile: Maya S.
  const maya = await prisma.user.create({
    data: {
      name: 'Maya S. (Teacher)',
      role: 'teacher',
      tokenBalance: 150,
      trustScore: 4.98,
      userSkills: {
        create: [
          { skillId: uiDesign.id, type: 'teaches' },
          { skillId: figma.id, type: 'teaches' },
          { skillId: python.id, type: 'wants_to_learn' }
        ]
      }
    }
  });

  // 3. Both Profile: Liam K.
  const liam = await prisma.user.create({
    data: {
      name: 'Liam K. (Both)',
      role: 'both',
      tokenBalance: 200,
      trustScore: 4.92,
      userSkills: {
        create: [
          { skillId: java.id, type: 'teaches' },
          { skillId: springBoot.id, type: 'teaches' },
          { skillId: react.id, type: 'wants_to_learn' }
        ]
      }
    }
  });

  // Create Sample Sessions between 3 Users
  const baseDate = new Date();
  baseDate.setHours(10, 0, 0, 0);

  const getRelativeDate = (daysOffset: number, hoursOffset: number) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + daysOffset);
    d.setHours(d.getHours() + hoursOffset);
    return d;
  };

  await prisma.session.create({
    data: {
      title: 'UI Design & Figma Fundamentals',
      teacherId: maya.id,
      studentId: alex.id,
      skillId: uiDesign.id,
      status: 'confirmed',
      scheduledAt: getRelativeDate(1, 0),
      durationMin: 60
    }
  });

  await prisma.session.create({
    data: {
      title: 'Enterprise Java & Spring Boot Overview',
      teacherId: liam.id,
      studentId: alex.id,
      skillId: java.id,
      status: 'pending',
      scheduledAt: getRelativeDate(2, 2),
      durationMin: 60
    }
  });

  // Sample Transactions
  await prisma.transaction.create({
    data: { userId: alex.id, amount: 15, description: 'Learned: UI Design from Maya S.', type: 'spent' }
  });
  await prisma.transaction.create({
    data: { userId: maya.id, amount: 17, description: 'Taught: UI Design to Alex (Student)', type: 'earned' }
  });

  // Sample Messages
  await prisma.message.createMany({
    data: [
      { senderId: alex.id, receiverId: maya.id, text: 'Hi Maya! I scheduled a UI Design session with you.' },
      { senderId: maya.id, receiverId: alex.id, text: 'Hi Alex! Looking forward to helping you master Figma and design systems!' },
      { senderId: alex.id, receiverId: liam.id, text: 'Hey Liam, interested in your Java & Spring Boot session.' },
      { senderId: liam.id, receiverId: alex.id, text: 'Awesome! Let us swap Java for React fundamentals.' }
    ]
  });

  // Sample Reviews
  await prisma.review.createMany({
    data: [
      { authorId: alex.id, targetId: maya.id, topic: 'UI Design & Figma', rating: 5, quote: 'Fantastic lesson! Clear, structured, and super helpful design system tips.', chips: ['Clear Explanations', 'Deep Knowledge', 'Patient'] },
      { authorId: alex.id, targetId: liam.id, topic: 'Java Systems', rating: 5, quote: 'Liam is a true Java expert. Great architectural breakdown!', chips: ['Punctual', 'Deep Knowledge'] }
    ]
  });

  console.log('Clean 3-user seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
