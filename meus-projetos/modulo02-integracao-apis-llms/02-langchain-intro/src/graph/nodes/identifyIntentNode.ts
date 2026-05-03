import { type GraphState } from "../graph.ts";

export function identifyIntent(state: GraphState): GraphState {
  const input = state.messages.at(-1)?.text ?? "";

  const lowerInput = input.toLowerCase();

  let command: GraphState["command"] = "unknown";

  if (lowerInput.includes("upper")) {
    command = "uppercase";
  } else if (lowerInput.includes("lower")) {
    command = "lowercase";
  }

  return {
    ...state,
    command,
    output: input,
  };
}
