console.assert(
  process.env.OPENROUTER_API_KEY,
  "Error: OPENROUTER_API_KEY is not set in the environment variables.",
);

export type ModelConfig = {
  apiKey: string;
  httpReferer: string;
  xTitle: string;
  port: number;
  models: string[];
  temperature: number;
  maxTokens: number;
  systemPrompt: string;

  provider: {
    sort: {
      by: string;
      partition: string;
    };
  };
};

export const config: ModelConfig = {
  apiKey: process.env.OPENROUTER_API_KEY!,
  httpReferer: "http://localhost:3000",
  xTitle: "SmartModelRouterGateway",
  port: 3000,
  models: [
    "stepfun/step-3.5-flash:free",
    "arcee-ai/trinity-large-preview:free",
    // "nvidia/nemotron-3-super-120b-a12b:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
  ],
  temperature: 0.2,
  maxTokens: 100,
  systemPrompt: "You are a helpful assistant",
  provider: {
    sort: {
      // by: "price",
      // by: "latency",
      by: "throughput",
      partition: "none",
    },
  },
};
