import { config } from "../../config.ts";
import { Neo4jService } from "../../services/neo4jService.ts";
import type { GraphState } from "../graph.ts";

async function executeQuery(query: string, neo4jService: Neo4jService) {
  try {
    const isValid = await neo4jService.validateQuery(query);

    if (!isValid) {
      return {
        results: null,
        error: "Invalid Cypher query",
      };
    }

    const results = await neo4jService.query(query);

    if (!results?.length) {
      return {
        results: [],
        error: "No results found for the query",
      };
    }

    console.log(`Retrieved ${results.length} results from Neo4j`);
    return {
      results,
      error: null,
    };
  } catch (error: any) {
    return {
      results: null,
      error: error?.message ?? "Error executing Cypher query",
    };
  }
}

function hasMoreSteps(state: GraphState): boolean {
  if (
    !state.isMultiStep ||
    !state.subQuestions?.length ||
    state.currentStep === undefined
  ) {
    return false;
  }

  return state.currentStep < state.subQuestions.length;
}

function handleMultiStepProgression(state: GraphState, results: any[]) {
  const updatedSubResults = [...(state.subResults ?? []), ...results];

  const nextStep = (state.currentStep ?? 0) + 1;

  const multiStepState = {
    dbResults: results,
    subResults: updatedSubResults,
    currentStep: nextStep,
    needsCorrection: false,
  };

  const totalSteps = state.subQuestions?.length ?? 0;
  console.log(
    `Step ${nextStep}/${totalSteps} completed. Results stored. Moving to next step...`,
  );

  if (hasMoreSteps({ ...state, ...multiStepState })) {
    console.log(`Proceeding to step ${nextStep + 1}...`);
    return multiStepState;
  }

  console.log(`All steps completed. Proceeding to response generation...`);
  return multiStepState;
}

export function createCypherExecutorNode(neo4jService: Neo4jService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    try {
      const { results, error } = await executeQuery(state.query!, neo4jService);

      if (error && results === null) {
        if ((state.correctionAttempts ?? 0) < config.maxCorrectionAttempts) {
          console.log(
            "Will attempt to correct the query and retry. Attempt number:",
            (state.correctionAttempts ?? 0) + 1,
          );
          return {
            validationError: error,
            originalQuery: state.originalQuery ?? state.query,
            needsCorrection: true,
          };
        }

        return {
          ...state,

          error: "Failed to execute Cypher query",
        };
      }

      if (
        state.isMultiStep &&
        state.subQuestions?.length &&
        state.currentStep !== undefined
      ) {
        const multiStepState = handleMultiStepProgression(state, results!);

        return { ...multiStepState };
      }

      if (!results?.length) {
        return {
          dbResults: [],
          error: "Query executed successfully but returned no results",
        };
      }

      return {
        ...state,
        dbResults: results,
        needsCorrection: false,
      };
    } catch (error) {
      console.error(
        "Error executing Cypher query:",
        error instanceof Error ? error.message : error,
      );

      return {
        ...state,
        error: "Invalid Cypher query - correction failed",
      };
    }
  };
}
