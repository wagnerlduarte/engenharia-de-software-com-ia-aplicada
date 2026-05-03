import type { GraphState } from "../graph.ts";
import {
  buildFollowUpQuestion,
  getMissingFields,
  inferIntentFromQuestion,
  type SupportedIntent,
} from "../../services/intentCompletenessService.ts";

const supportedIntents: SupportedIntent[] = ["schedule", "cancel", "reschedule"];

function isSupportedIntent(intent: GraphState["intent"]): intent is SupportedIntent {
  return intent === "schedule" || intent === "cancel" || intent === "reschedule";
}

export function createValidateRequiredFieldsNode() {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    const question = state.messages.at(-1)?.text;
    const inferredIntent = question ? inferIntentFromQuestion(question) : undefined;

    const intent = isSupportedIntent(state.intent)
      ? state.intent
      : state.pendingIntent ?? inferredIntent;

    if (!intent) {
      return state;
    }

    const missingFields = getMissingFields(intent, state);

    if (missingFields.length === 0) {
      return {
        ...state,
        intent,
        pendingIntent: undefined,
        needsMoreInfo: false,
        missingFields: [],
        followUpQuestion: undefined,
      };
    }

    return {
      ...state,
      intent,
      pendingIntent: intent,
      actionSuccess: false,
      needsMoreInfo: true,
      missingFields,
      followUpQuestion: buildFollowUpQuestion(intent, missingFields),
      actionError: `Missing required fields: ${missingFields.join(", ")}`,
    };
  };
}
