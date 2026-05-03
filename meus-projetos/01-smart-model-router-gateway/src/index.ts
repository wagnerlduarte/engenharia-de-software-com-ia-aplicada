import { createServer } from "./server.ts";
import { OpenRouterService } from "./openrouterService.ts";
import { config } from "./config.ts";

const routerService = new OpenRouterService(config);
const app = createServer(routerService);

await app.listen({ port: 3000, host: "0.0.0.0" });

// app.log.info("Server is running at http://localhost:3000");
console.info("Server is running at http://localhost:3000");

app
  .inject({
    method: "POST",
    url: "/chat",
    payload: {
      question: "What is the capital of France?",
    },
  })
  .then((response) => {
    console.log("Response from /chat:", response.json());
  });
