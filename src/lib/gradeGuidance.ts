export interface GradeLevelGuidance {
  grade: number | null
  target_thinking_level: string
  recommended_question_types: string
}

const FALLBACK_GUIDANCE: GradeLevelGuidance = {
  grade: null,
  target_thinking_level: 'Use a general grade-appropriate mix of Remember, Understand, Apply, and Analyze questions.',
  recommended_question_types: 'Use clear MCQs, short answer questions, medium answer questions, and long answer questions suitable for the stated grade.',
}

const GRADE_GUIDANCE: Record<number, Omit<GradeLevelGuidance, 'grade'>> = {
  1: {
    target_thinking_level: 'Mostly Remember / Understand, DOK 1: recall and basic comprehension.',
    recommended_question_types: 'Picture-based recognition, simple multiple choice with 2-3 options, one-to-one matching, fill-in-the-blank with word bank, copy/trace words, and very short one-word or phrase responses.',
  },
  2: {
    target_thinking_level: 'Remember / Understand with introduction to simple Apply, DOK 1-2.',
    recommended_question_types: 'Multiple choice with 3 options, matching word-definition or question-answer pairs, short fill-in-the-blank, true/false, sequencing items, and very short why/how questions with one-sentence answers.',
  },
  3: {
    target_thinking_level: 'Understand / Apply with simple Analyze, DOK 1-2.',
    recommended_question_types: 'Standard MCQ with 3-4 options, multi-step word problems, short answers of 1-2 sentences explaining reasoning, matching with extra choices, sorting/classifying, and simple graphic organizers.',
  },
  4: {
    target_thinking_level: 'Apply / basic Analyze, with some DOK 2-3 items.',
    recommended_question_types: 'Best-answer MCQs with plausible distractors, short constructed responses of 2-3 sentences, explain-your-thinking follow-ups, compare/contrast questions, data interpretation from charts/tables, and cause-effect questions.',
  },
  5: {
    target_thinking_level: 'Apply / Analyze with starter Evaluate, DOK 2-3.',
    recommended_question_types: 'Multi-part MCQs, short evidence-based responses, choose-and-justify items, cloze passages, one-paragraph writing prompts, and graph/table interpretation questions.',
  },
  6: {
    target_thinking_level: 'Analyze + Apply with more open-ended questions, DOK 2-3.',
    recommended_question_types: 'MCQs on multi-step situations, short constructed responses of 3-4 sentences, relationship analysis, error analysis, basic argument questions, and fill-in tables/diagrams.',
  },
  7: {
    target_thinking_level: 'Analyze / Evaluate, DOK 2-3 with some DOK 4.',
    recommended_question_types: 'Scenario-based MCQs, extended short answers with evidence, justification questions with multiple reasons, compare-source questions, classify-and-explain tasks, and design-a-solution prompts with constraints.',
  },
  8: {
    target_thinking_level: 'Analyze / Evaluate / beginning Create, with some DOK 3-4 items.',
    recommended_question_types: 'Complex best-answer MCQs, constructed responses citing text/data evidence, author-purpose or point-of-view questions, compare/evaluate arguments or methods, model/experiment design prompts, and hypothetical what-if reasoning questions.',
  },
  9: {
    target_thinking_level: 'Analyze / Evaluate / Create, DOK 2-4.',
    recommended_question_types: 'Passage-based MCQs, short essays of 1-2 paragraphs, complex graph/table interpretation, error analysis and improve-the-solution tasks, debate-style prompts, and simple project-planning questions.',
  },
  10: {
    target_thinking_level: 'Strong Analyze / Evaluate with frequent Create tasks, DOK 3-4.',
    recommended_question_types: 'Multi-source items, analytical essay prompts, constructed responses requiring reasoning chains, evaluate-solution or evaluate-argument tasks, experiment/model design prompts, and transform/reframe/generalize tasks.',
  },
  11: {
    target_thinking_level: 'High-level Evaluate / Create, DOK 3-4.',
    recommended_question_types: 'AP/SAT-style MCQs, long constructed responses, synthesis questions using multiple sources, critique and revision tasks, project design outlines, and extend-the-model or extend-the-theory questions.',
  },
  12: {
    target_thinking_level: 'Independent Evaluate / Create and synthesis, DOK 3-4.',
    recommended_question_types: 'College-readiness MCQs, extended analytical writing, synthesis across sources/data, evaluation using criteria, proposal/design prompts with predicted outcomes, and transfer questions applying concepts to unfamiliar contexts.',
  },
}

export function parseGradeLevel(gradeText: string) {
  const normalized = gradeText.trim().toLowerCase()
  const match = normalized.match(/(?:grade|class|standard|std)?\s*(1[0-2]|[1-9])\b/)
  if (!match) return null
  return Number(match[1])
}

export function getGradeLevelGuidance(gradeText: string): GradeLevelGuidance {
  const grade = parseGradeLevel(gradeText)
  const guidance = grade ? GRADE_GUIDANCE[grade] : null
  if (!grade || !guidance) return FALLBACK_GUIDANCE
  return { grade, ...guidance }
}

export function buildWorksheetFormatInstruction({
  worksheetMcqQuestions,
  oneMarkQuestions,
  twoMarkQuestions,
  fiveMarkQuestions,
  quizMcqQuestions,
  gradeGuidance,
}: {
  worksheetMcqQuestions: number
  oneMarkQuestions: number
  twoMarkQuestions: number
  fiveMarkQuestions: number
  quizMcqQuestions: number
  gradeGuidance: GradeLevelGuidance
}) {
  return [
    `Create a worksheet with exactly four sections: Section A - Multiple Choice Questions (${worksheetMcqQuestions} questions, 1 mark each), Section B - One Word / One Sentence Answer Questions (${oneMarkQuestions} questions, 1 mark each), Section C - Short Answer Questions (${twoMarkQuestions} questions, 2 marks each), and Section D - Long Answer Questions (${fiveMarkQuestions} questions, 5 marks each).`,
    'Worksheet MCQs must be generated as new worksheet questions inside the worksheet object, not copied from the quiz MCQs.',
    `Create exactly ${quizMcqQuestions} separate MCQ quiz questions for the Quiz tab.`,
    `Use this grade-level guidance for worksheet questions first and quiz MCQs second: ${gradeGuidance.target_thinking_level}`,
    `Prefer these question styles where they fit naturally: ${gradeGuidance.recommended_question_types}`,
    'Keep the student worksheet clean: do not add Bloom, DOK, thinking-level, or question-type labels unless the question itself naturally requires that language.',
    'In the answer_key.worksheet_answers array, answer Section C short-answer questions with about 30-50 words each. Answer Section D long-answer questions with about 100-150 words each. Keep Section A MCQ and Section B one-word/one-sentence answers concise. Put the complete model answer in the answer field; use explanation only for brief marking guidance if needed.',
  ].join(' ')
}

export function buildAnswerKeyInstruction() {
  return [
    'For answer_key.worksheet_answers, write complete model answers at the correct length for each worksheet section.',
    'Section C - Short Answer Questions: each answer should be around 30-50 words.',
    'Section D - Long Answer Questions: each answer should be around 100-150 words.',
    'Section A MCQ answers and Section B one-word/one-sentence answers should stay concise.',
    'Put the full model answer in the answer field, not only in explanation.',
  ].join(' ')
}
