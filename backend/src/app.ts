import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler, notFoundHandler } from './middlewares/error';
import authRoutes from './routes/auth.routes';
import chatRoutes from './routes/chat.routes';
import notificationsRoutes from './routes/notifications.routes';
import navRoutes from './routes/nav.routes';
import studentRoutes from './routes/student.routes';
import teacherRoutes from './routes/teacher.routes';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Цифровий світ класу працює' });
});

app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/nav', navRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
