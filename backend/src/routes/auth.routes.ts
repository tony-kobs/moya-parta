import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.post('/login', authController.login);
router.post('/register/teacher', authController.registerTeacher);
router.post('/register/student', authController.registerStudent);
router.get('/invite/:code', authController.getInvitePreview);
router.get('/me', authMiddleware, authController.me);

export default router;
