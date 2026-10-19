import type { AssessmentForm, SeverityBand } from "./types";

// PHQ-9 and GAD-7 were developed by Drs. Spitzer, Williams, Kroenke and colleagues with an
// educational grant from Pfizer; no permission is required to reproduce or use them.
// Arabic wording is left empty on purpose: use the clinic's validated Arabic versions
// rather than an ad hoc translation.

const frequency = [
  { label: "Not at all", value: 0 },
  { label: "Several days", value: 1 },
  { label: "More than half the days", value: 2 },
  { label: "Nearly every day", value: 3 },
];

const q = (id: string, text: string) => ({ id, text, options: frequency });

export const PHQ9: AssessmentForm = {
  code: "PHQ-9",
  title: "Patient Health Questionnaire (PHQ-9)",
  instructions: "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
  questions: [
    q("q1", "Little interest or pleasure in doing things"),
    q("q2", "Feeling down, depressed, or hopeless"),
    q("q3", "Trouble falling or staying asleep, or sleeping too much"),
    q("q4", "Feeling tired or having little energy"),
    q("q5", "Poor appetite or overeating"),
    q("q6", "Feeling bad about yourself, or that you are a failure or have let yourself or your family down"),
    q("q7", "Trouble concentrating on things, such as reading the newspaper or watching television"),
    q(
      "q8",
      "Moving or speaking so slowly that other people could have noticed, or the opposite: being so fidgety or restless that you have been moving around a lot more than usual",
    ),
    q("q9", "Thoughts that you would be better off dead, or of hurting yourself in some way"),
  ],
  bands: [
    { min: 0, max: 4, label: "Minimal", level: 0 },
    { min: 5, max: 9, label: "Mild", level: 1 },
    { min: 10, max: 14, label: "Moderate", level: 2 },
    { min: 15, max: 19, label: "Moderately severe", level: 3 },
    { min: 20, max: 27, label: "Severe", level: 4 },
  ],
  safetyItems: ["q9"],
  active: true,
};

export const GAD7: AssessmentForm = {
  code: "GAD-7",
  title: "Generalized Anxiety Disorder (GAD-7)",
  instructions: "Over the last 2 weeks, how often have you been bothered by the following problems?",
  questions: [
    q("q1", "Feeling nervous, anxious, or on edge"),
    q("q2", "Not being able to stop or control worrying"),
    q("q3", "Worrying too much about different things"),
    q("q4", "Trouble relaxing"),
    q("q5", "Being so restless that it is hard to sit still"),
    q("q6", "Becoming easily annoyed or irritable"),
    q("q7", "Feeling afraid, as if something awful might happen"),
  ],
  bands: [
    { min: 0, max: 4, label: "Minimal", level: 0 },
    { min: 5, max: 9, label: "Mild", level: 1 },
    { min: 10, max: 14, label: "Moderate", level: 2 },
    { min: 15, max: 21, label: "Severe", level: 4 },
  ],
  active: true,
};

export const SEED_FORMS: Record<string, AssessmentForm> = { phq9: PHQ9, gad7: GAD7 };

export interface ScoreResult {
  score: number;
  maxScore: number;
  band: SeverityBand | undefined;
  safetyFlag: boolean;
  missing: string[];
}

/** Sums the answers and finds the severity band. Used by the scoring Cloud Function. */
export function scoreAssessment(form: AssessmentForm, answers: Record<string, number>): ScoreResult {
  const missing: string[] = [];
  let score = 0;
  for (const question of form.questions) {
    const value = answers[question.id];
    const allowed = question.options.some((o) => o.value === value);
    if (value === undefined || !allowed) {
      missing.push(question.id);
      continue;
    }
    score += value;
  }
  const band = form.bands.find((b) => score >= b.min && score <= b.max);
  const safetyFlag = (form.safetyItems ?? []).some((id) => (answers[id] ?? 0) > 0);
  const maxScore = form.questions.reduce((sum, q) => sum + Math.max(...q.options.map((o) => o.value)), 0);
  return { score, maxScore, band, safetyFlag, missing };
}
