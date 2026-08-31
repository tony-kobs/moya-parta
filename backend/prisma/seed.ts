import { PrismaClient } from '@prisma/client';
import {
  achievements,
  backpackItems,
  chatMessages,
  classes,
  events,
  homeworks,
  homeworkSubmissions,
  learningMaterials,
  navSeen,
  notifications,
  posts,
  questProgress,
  quests,
  quizTemplates,
  quizzes,
  schools,
  studentAchievements,
  studentProfiles,
  users,
  xpTransactions,
} from '../src/data/seed';

const prisma = new PrismaClient();

async function main() {
  // Clear in FK-safe order
  await prisma.navSeen.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.xpTransaction.deleteMany();
  await prisma.studentAchievement.deleteMany();
  await prisma.questProgress.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.homeworkSubmission.deleteMany();
  await prisma.post.deleteMany();
  await prisma.classEvent.deleteMany();
  await prisma.learningMaterial.deleteMany();
  await prisma.quest.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.homework.deleteMany();
  await prisma.classMembership.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.user.updateMany({ data: { classId: null } });
  await prisma.classRoom.deleteMany();
  await prisma.user.deleteMany();
  await prisma.school.deleteMany();
  await prisma.quizTemplate.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.backpackItem.deleteMany();

  for (const school of schools) {
    await prisma.school.create({ data: school });
  }

  // Users without classId first (FK to ClassRoom)
  for (const user of users) {
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        schoolId: user.schoolId,
        classId: null,
        avatarColor: user.avatarColor,
        avatarEmoji: user.avatarEmoji,
      },
    });
  }

  for (const classRoom of classes) {
    await prisma.classRoom.create({
      data: {
        id: classRoom.id,
        schoolId: classRoom.schoolId,
        name: classRoom.name,
        grade: classRoom.grade,
        teacherId: classRoom.teacherId,
        inviteCode: classRoom.inviteCode,
        goalTargetXp: classRoom.goalTargetXp,
        goalCurrentXp: classRoom.goalCurrentXp,
        goalTitle: classRoom.goalTitle,
      },
    });

    for (const studentId of classRoom.studentIds) {
      await prisma.classMembership.create({
        data: { classId: classRoom.id, studentId },
      });
    }
  }

  for (const user of users) {
    if (user.classId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { classId: user.classId },
      });
    }
  }

  for (const profile of studentProfiles) {
    await prisma.studentProfile.create({
      data: {
        userId: profile.userId,
        level: profile.level,
        xp: profile.xp,
        xpToNextLevel: profile.xpToNextLevel,
        unlockedItems: profile.unlockedItems,
        onboardingCompleted: profile.onboardingCompleted,
      },
    });
  }

  for (const post of posts) {
    await prisma.post.create({
      data: {
        id: post.id,
        authorId: post.authorId,
        classId: post.classId,
        schoolId: post.schoolId,
        text: post.text,
        imageEmoji: post.imageEmoji,
        category: post.category,
        status: post.status,
        createdAt: new Date(post.createdAt),
        reactions: post.reactions,
      },
    });
  }

  for (const template of quizTemplates) {
    await prisma.quizTemplate.create({
      data: {
        id: template.id,
        subject: template.subject,
        title: template.title,
        description: template.description,
        xpReward: template.xpReward,
        questions: template.questions,
      },
    });
  }

  for (const quiz of quizzes) {
    await prisma.quiz.create({
      data: {
        id: quiz.id,
        classId: quiz.classId,
        subject: quiz.subject,
        title: quiz.title,
        xpReward: quiz.xpReward,
        questions: quiz.questions,
        templateId: quiz.templateId,
      },
    });
  }

  for (const hw of homeworks) {
    await prisma.homework.create({
      data: {
        id: hw.id,
        classId: hw.classId,
        subject: hw.subject,
        title: hw.title,
        description: hw.description,
        dueDate: new Date(hw.dueDate),
        startsAt: new Date(hw.startsAt),
        endsAt: new Date(hw.endsAt),
        xpReward: hw.xpReward,
        createdBy: hw.createdBy,
        linkedQuizId: hw.linkedQuizId,
      },
    });
  }

  for (const sub of homeworkSubmissions) {
    await prisma.homeworkSubmission.create({
      data: {
        id: sub.id,
        homeworkId: sub.homeworkId,
        studentId: sub.studentId,
        status: sub.status,
        answer: sub.answer,
        teacherComment: sub.teacherComment,
        submittedAt: sub.submittedAt ? new Date(sub.submittedAt) : null,
        reviewedAt: sub.reviewedAt ? new Date(sub.reviewedAt) : null,
      },
    });
  }

  for (const quest of quests) {
    await prisma.quest.create({
      data: {
        id: quest.id,
        classId: quest.classId,
        title: quest.title,
        description: quest.description,
        illustration: quest.illustration,
        xpReward: quest.xpReward,
        totalSteps: quest.totalSteps,
        questions: quest.questions ?? undefined,
        questionSource: quest.questionSource ?? null,
      },
    });
  }

  for (const progress of questProgress) {
    await prisma.questProgress.create({
      data: {
        questId: progress.questId,
        studentId: progress.studentId,
        currentStep: progress.currentStep,
        completed: progress.completed,
      },
    });
  }

  for (const achievement of achievements) {
    await prisma.achievement.create({ data: achievement });
  }

  for (const sa of studentAchievements) {
    await prisma.studentAchievement.create({
      data: {
        studentId: sa.studentId,
        achievementId: sa.achievementId,
        unlockedAt: new Date(sa.unlockedAt),
      },
    });
  }

  for (const event of events) {
    await prisma.classEvent.create({
      data: {
        id: event.id,
        classId: event.classId,
        title: event.title,
        description: event.description,
        date: event.date ? new Date(event.date) : null,
        startsAt: new Date(event.startsAt),
        endsAt: new Date(event.endsAt),
        participantIds: event.participantIds,
        progress: event.progress,
        materials: event.materials,
        reviewComment: event.reviewComment,
        reviewedAt: event.reviewedAt ? new Date(event.reviewedAt) : null,
        publishedPostId: event.publishedPostId,
      },
    });
  }

  for (const notif of notifications) {
    await prisma.notification.create({
      data: {
        id: notif.id,
        userId: notif.userId,
        title: notif.title,
        body: notif.body,
        read: notif.read,
        createdAt: new Date(notif.createdAt),
        type: notif.type,
      },
    });
  }

  for (const xp of xpTransactions) {
    await prisma.xpTransaction.create({
      data: {
        id: xp.id,
        studentId: xp.studentId,
        amount: xp.amount,
        reason: xp.reason,
        createdAt: new Date(xp.createdAt),
      },
    });
  }

  for (const item of backpackItems) {
    await prisma.backpackItem.create({ data: item });
  }

  for (const material of learningMaterials) {
    await prisma.learningMaterial.create({ data: material });
  }

  for (const msg of chatMessages) {
    await prisma.chatMessage.create({
      data: {
        id: msg.id,
        classId: msg.classId,
        schoolId: msg.schoolId,
        kind: msg.kind,
        senderId: msg.senderId,
        recipientId: msg.recipientId,
        text: msg.text,
        createdAt: new Date(msg.createdAt),
      },
    });
  }

  for (const [userId, sections] of Object.entries(navSeen)) {
    for (const [section, seenAt] of Object.entries(sections)) {
      if (!seenAt) continue;
      await prisma.navSeen.create({
        data: {
          userId,
          section,
          seenAt: new Date(seenAt),
        },
      });
    }
  }

  console.log('Seed complete: demo teacher/student + class 3B-DEMO');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
