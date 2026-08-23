import type { Grade, QuestQuestion } from '../types';

/**
 * Curriculum-aligned question banks for the «Математична експедиція» quest,
 * one five-question set per grade (1–4). The backend picks the set that
 * matches the student's own class grade — never a client-supplied value.
 */
export const mathExpeditionQuestionsByGrade: Record<Grade, QuestQuestion[]> = {
  1: [
    {
      id: 'math-g1-q1',
      text: 'Скільки буде 5 + 3?',
      options: ['7', '8', '9', '6'],
      correctIndex: 1,
    },
    {
      id: 'math-g1-q2',
      text: 'Скільки буде 9 − 4?',
      options: ['4', '6', '5', '3'],
      correctIndex: 2,
    },
    {
      id: 'math-g1-q3',
      text: 'Яке число більше: 42 чи 24?',
      options: ['24', '42', 'Вони рівні', 'Не можна порівняти'],
      correctIndex: 1,
    },
    {
      id: 'math-g1-q4',
      text: 'Яка це фігура: 🔺',
      options: ['Коло', 'Квадрат', 'Трикутник', 'Прямокутник'],
      correctIndex: 2,
    },
    {
      id: 'math-g1-q5',
      text: 'У кошику 6 яблук, а груш на 2 більше. Скільки груш у кошику?',
      options: ['4', '8', '6', '7'],
      correctIndex: 1,
    },
  ],
  2: [
    {
      id: 'math-g2-q1',
      text: 'Скільки буде 47 + 28?',
      options: ['65', '75', '85', '70'],
      correctIndex: 1,
    },
    {
      id: 'math-g2-q2',
      text: 'Скільки буде 62 − 37?',
      options: ['35', '15', '25', '29'],
      correctIndex: 2,
    },
    {
      id: 'math-g2-q3',
      text: 'Скільки буде 3 × 4?',
      options: ['7', '10', '9', '12'],
      correctIndex: 3,
    },
    {
      id: 'math-g2-q4',
      text: 'Скільки сантиметрів в 1 метрі?',
      options: ['10', '100', '1000', '50'],
      correctIndex: 1,
    },
    {
      id: 'math-g2-q5',
      text: 'У класі 24 учні. Їх поділили порівну на 4 команди. Скільки учнів у команді?',
      options: ['5', '8', '6', '4'],
      correctIndex: 2,
    },
  ],
  3: [
    {
      id: 'math-g3-q1',
      text: 'Скільки буде 342 + 259?',
      options: ['591', '601', '611', '501'],
      correctIndex: 1,
    },
    {
      id: 'math-g3-q2',
      text: 'Скільки буде 7 × 8?',
      options: ['54', '64', '56', '48'],
      correctIndex: 2,
    },
    {
      id: 'math-g3-q3',
      text: 'Скільки буде 29 : 4 (з остачею)?',
      options: ['6 ост. 5', '7 ост. 1', '7 ост. 2', '8 ост. 0'],
      correctIndex: 1,
    },
    {
      id: 'math-g3-q4',
      text: 'Скільки це — 1/4 від 20?',
      options: ['4', '5', '10', '6'],
      correctIndex: 1,
    },
    {
      id: 'math-g3-q5',
      text: 'У бібліотеці було 500 книг. Принесли ще 120, а потім видали 80 учням. Скільки книг залишилось?',
      options: ['540', '460', '600', '380'],
      correctIndex: 0,
    },
  ],
  4: [
    {
      id: 'math-g4-q1',
      text: 'Скільки буде 235 000 + 148 500?',
      options: ['373 500', '383 500', '393 500', '283 500'],
      correctIndex: 1,
    },
    {
      id: 'math-g4-q2',
      text: 'Розвʼяжи рівняння: x + 250 = 900. Чому дорівнює x?',
      options: ['550', '650', '1150', '750'],
      correctIndex: 1,
    },
    {
      id: 'math-g4-q3',
      text: 'Скільки буде 3/5 + 1/5?',
      options: ['4/10', '4/5', '2/5', '1'],
      correctIndex: 1,
    },
    {
      id: 'math-g4-q4',
      text: 'Потяг їде зі швидкістю 60 км/год. Скільки кілометрів він проїде за 3 години?',
      options: ['120 км', '160 км', '180 км', '200 км'],
      correctIndex: 2,
    },
    {
      id: 'math-g4-q5',
      text: 'Скільки грамів у 2,5 кг?',
      options: ['250 г', '2500 г', '25 г', '25 000 г'],
      correctIndex: 1,
    },
  ],
};
