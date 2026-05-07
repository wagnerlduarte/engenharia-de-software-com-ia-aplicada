import config from '../../config.ts';
import { RedshiftService } from '../../services/redshiftService.ts';
import type { GraphState } from '../graph.ts';

async function executeQuery(query: string, redshiftService: RedshiftService) {
  try {
    if (!redshiftService.containsHostnameFilter(query)) {
      return {
        results: null,
        error: 'Query rejected: missing mandatory hostname filter',
      };
    }

    if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b/i.test(query)) {
      return {
        results: null,
        error: 'Query rejected: only SELECT statements are allowed',
      };
    }

    const results = await redshiftService.query(query);

    if (!results.length) {
      console.log('⚠️  Query returned 0 rows');
      return { results: [], error: null };
    }

    console.log(`✅ Retrieved ${results.length} result(s)`);
    return { results, error: null };
  } catch (error: any) {
    return {
      results: null,
      error: error?.message ?? 'Query execution error',
    };
  }
}

function hasMoreSteps(state: GraphState, nextStep: number): boolean {
  if (!state.isMultiStep || !state.subQuestions?.length) {
    return false;
  }
  return nextStep < state.subQuestions.length;
}

function handleMultiStepProgression(state: GraphState, results: any[]) {
  const stepIndex = state.currentStep ?? 0;
  const nextStep = stepIndex + 1;

  const subResults = [...(state.subResults ?? [])];
  subResults[stepIndex] = results;

  const totalSteps = state.subQuestions?.length ?? 0;
  console.log(`✅ Step ${nextStep}/${totalSteps} completed (${results.length} row(s))`);

  if (hasMoreSteps(state, nextStep)) {
    console.log(`➡️  Moving to step ${nextStep + 1}...`);
  } else {
    console.log(`✅ All ${totalSteps} steps completed - synthesizing results`);
  }

  return {
    dbResults: results,
    subResults,
    currentStep: nextStep,
    needsCorrection: false,
  };
}

export function createSqlExecutorNode(redshiftService: RedshiftService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    try {
      const { results, error } = await executeQuery(state.query!, redshiftService);

      if (results === null) {
        const attempts = state.correctionAttempts ?? 0;
        const reason = error ?? 'Unknown execution error';
        console.log(`❌ SQL execution error (attempt ${attempts}/${config.maxCorrectionAttempts}): ${reason}`);

        if (attempts < config.maxCorrectionAttempts) {
          console.log('🔍 Will attempt to auto-correct query...');
          return {
            validationError: reason,
            originalQuery: state.originalQuery ?? state.query,
            needsCorrection: true,
          };
        }

        console.log(`🛑 Correction budget exhausted (${attempts} attempts) - giving up on this query`);
        return { error: `Invalid SQL query - correction failed after ${attempts} attempt(s). Last error: ${reason}` };
      }

      if (state.isMultiStep && state.subQuestions?.length && state.currentStep !== undefined) {
        return handleMultiStepProgression(state, results);
      }

      return {
        dbResults: results,
        needsCorrection: false,
      };
    } catch (error) {
      console.error('Error executing SQL query:', error instanceof Error ? error.message : error);
      return { error: 'SQL query execution failed' };
    }
  };
}
