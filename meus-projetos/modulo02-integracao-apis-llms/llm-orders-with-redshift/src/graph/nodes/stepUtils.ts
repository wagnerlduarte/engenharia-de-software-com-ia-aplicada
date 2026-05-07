import type { GraphState } from '../graph.ts';

export type CurrentStepInfo = {
  question: string;
  stepNumber: number;
  index: number;
  total: number;
};

export function getCurrentStepInfo(state: GraphState): CurrentStepInfo | null {
  if (
    !state.isMultiStep ||
    !state.subQuestions?.length ||
    state.currentStep === undefined
  ) {
    return null;
  }

  if (state.currentStep >= state.subQuestions.length) {
    return null;
  }

  return {
    question: state.subQuestions[state.currentStep],
    stepNumber: state.currentStep + 1,
    index: state.currentStep,
    total: state.subQuestions.length,
  };
}

export function getTargetQuestion(state: GraphState): string {
  const stepInfo = getCurrentStepInfo(state);
  return stepInfo?.question ?? state.question ?? '';
}
