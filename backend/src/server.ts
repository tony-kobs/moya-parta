import path from 'path';
import dotenv from 'dotenv';
import app from './app';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = Number(process.env.PORT) || 4000;

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing. Copy backend/.env.example → backend/.env');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
