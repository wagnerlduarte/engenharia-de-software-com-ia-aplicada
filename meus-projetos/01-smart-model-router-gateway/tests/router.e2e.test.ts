import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.ts";
import { config } from "../src/config.ts";
import {
  type LLMResponse,
  OpenRouterService,
} from "../src/openrouterService.ts";

console.assert(
  process.env.OPENROUTER_API_KEY,
  "Error: OPENROUTER_API_KEY is not set in the environment variables.",
);

test("routes to cheapest model by defult", async () => {
  const customConfig = {
    ...config,
    provider: {
      ...config.provider,
      sort: {
        ...config.provider.sort,
        by: "price",
      },
    },
  };

  const routerService = new OpenRouterService(customConfig);
  const app = createServer(routerService);

  const response = await app.inject({
    method: "POST",
    url: "/chat",
    payload: {
      question: "What is the capital of France?",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as LLMResponse;

  assert.equal(body.model, "stepfun/step-3.5-flash:free");
});

test("routes to highest throughput model by default", async () => {
  const customConfig = {
    ...config,
    provider: {
      ...config.provider,
      sort: {
        ...config.provider.sort,
        by: "throughput",
      },
    },
  };

  const routerService = new OpenRouterService(customConfig);
  const app = createServer(routerService);

  const response = await app.inject({
    method: "POST",
    url: "/chat",
    payload: {
      question: "What is the capital of France?",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as LLMResponse;

  assert.equal(
    body.model,
    "nvidia/nemotron-3-nano-30b-a3b:free",
  );
});
