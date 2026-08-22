import { Router } from 'express';
import * as chatController from '../controllers/chat.controller';
import { authMiddleware, requireRoles } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);
router.use(requireRoles('student', 'teacher'));

router.get('/contacts', chatController.getContacts);
router.get('/class', chatController.getClassChat);
router.post('/class', chatController.sendClassMessage);
router.get('/direct/:userId', chatController.getDirectThread);
router.post('/direct/:userId', chatController.sendDirectMessage);

export default router;
