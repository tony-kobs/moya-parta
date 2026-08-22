import { Router } from 'express';
import * as navController from '../controllers/nav.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);
router.get('/badges', navController.getBadges);
router.post('/seen', navController.markSeen);

export default router;
