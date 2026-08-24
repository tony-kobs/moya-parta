import { Router } from 'express';
import * as learningController from '../controllers/learning.controller';
import * as studentController from '../controllers/student.controller';
import { authMiddleware, requireRoles } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/desk', requireRoles('student'), studentController.getDesk);
router.get('/backpack', requireRoles('student'), studentController.getBackpack);
router.post(
  '/onboarding/complete',
  requireRoles('student'),
  studentController.completeOnboarding,
);
router.get(
  '/class',
  requireRoles('student', 'teacher'),
  studentController.getClass,
);
router.get('/board', requireRoles('student'), studentController.getMyBoard);
router.post(
  '/posts',
  requireRoles('student', 'teacher'),
  studentController.createPost,
);
router.post(
  '/posts/:id/reactions',
  requireRoles('student', 'teacher'),
  studentController.reactToPost,
);
router.get('/learning', requireRoles('student'), learningController.getLearning);
router.post(
  '/homework/:id/submit',
  requireRoles('student'),
  learningController.submitHomework,
);
router.get('/quizzes/:id', requireRoles('student'), learningController.getQuiz);
router.post(
  '/quizzes/:id/submit',
  requireRoles('student'),
  learningController.submitQuiz,
);
router.get('/quests/:id', requireRoles('student'), learningController.getQuest);
router.post(
  '/quests/:id/advance',
  requireRoles('student'),
  learningController.advanceQuest,
);
router.post(
  '/quests/:id/answer',
  requireRoles('student'),
  learningController.answerQuest,
);
router.get(
  '/achievements',
  requireRoles('student'),
  learningController.getAchievements,
);
router.get(
  '/events',
  requireRoles('student', 'teacher'),
  learningController.getEvents,
);
router.post(
  '/events/:id/join',
  requireRoles('student'),
  learningController.joinEvent,
);

export default router;
