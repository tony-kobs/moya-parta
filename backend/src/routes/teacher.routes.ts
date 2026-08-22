import { Router } from 'express';
import * as teacherController from '../controllers/teacher.controller';
import { authMiddleware, requireRoles } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);
router.use(requireRoles('teacher'));

router.get('/dashboard', teacherController.getDashboard);
router.post('/homework', teacherController.createHomework);
router.delete('/homework/:id', teacherController.deleteHomework);
router.post('/submissions/:id/review', teacherController.reviewSubmission);
router.get('/quiz-templates', teacherController.getQuizTemplates);
router.get('/quizzes', teacherController.getClassQuizzes);
router.post('/quizzes/from-template', teacherController.assignQuizFromTemplate);
router.post('/quizzes', teacherController.createQuiz);
router.delete('/quizzes/:id', teacherController.deleteQuiz);
router.get('/events', teacherController.getEvents);
router.post('/events', teacherController.createEvent);
router.post('/events/:id/publish', teacherController.publishEventReview);
router.delete('/events/:id', teacherController.deleteEvent);
router.get('/moderation/posts', teacherController.getPendingPosts);
router.post('/moderation/posts/:id', teacherController.moderatePost);
router.post('/quests', teacherController.createQuest);
router.post('/classes', teacherController.createClass);
router.get('/invite', teacherController.getInvite);
router.post('/invite/regenerate', teacherController.regenerateInvite);

export default router;
