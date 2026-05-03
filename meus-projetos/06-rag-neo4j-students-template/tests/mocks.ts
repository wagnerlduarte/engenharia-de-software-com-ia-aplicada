export type MockLLMResult = {
  data?: any;
  error?: string;
  hang?: boolean;
};

export class MockOpenRouterService {
  private readonly queue: MockLLMResult[];

  constructor(results: MockLLMResult[] = []) {
    this.queue = [...results];
  }

  async generateStructured<T>(): Promise<{
    success: boolean;
    data?: T;
    error?: string;
  }> {
    const next = this.queue.shift() ?? {};

    if (next.hang) {
      return new Promise(() => {
        // Intentionally never resolves to simulate upstream LLM hanging.
      });
    }

    if (next.error) {
      return {
        success: false,
        error: next.error,
      };
    }

    if (typeof next.data === "undefined") {
      return {
        success: false,
        error: "Model returned an empty structured response",
      };
    }

    return {
      success: true,
      data: next.data as T,
    };
  }
}

export type MockNeo4jOptions = {
  schema?: string;
  validateResult?: boolean;
  queryResult?: any[];
  queryError?: string;
};

export function createMockNeo4jService(options: MockNeo4jOptions = {}) {
  const {
    schema = "mock schema",
    validateResult = true,
    queryResult = [],
    queryError,
  } = options;

  return {
    async getSchema(): Promise<string> {
      return schema;
    },
    async validateQuery(): Promise<boolean> {
      return validateResult;
    },
    async query(): Promise<any[]> {
      if (queryError) {
        throw new Error(queryError);
      }
      return queryResult;
    },
  };
}
