/** Le quiz du jour : 10 questions (0014_quiz_quotidien.sql). */
export interface QuizDone {
  id: number;
  question: string;
  choices: string[];
  choice: number;
  answer: number;
  correct: boolean;
  explanation: string;
  /** Part des collègues qui ont trouvé, en %. */
  good_pct: number | null;
}

export interface Quiz {
  day: string;
  total: number;
  answered: number;
  score: number;
  done: QuizDone[];
  current: { id: number; question: string; choices: string[] } | null;
  finished: number;
  avg_score: number | null;
}
