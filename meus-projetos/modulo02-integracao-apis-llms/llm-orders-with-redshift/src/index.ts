import { createServer } from "./server.ts";

const app = createServer();

await app.listen({ port: 4000, host: "0.0.0.0" });
console.log("Server is running on http://0.0.0.0:4000");
console.log('POST /orders - { "question": "...", "hostname": "store_name" }');
console.log("GET  /health - Health check\n");

// app
//   .inject({
//     method: "POST",
//     url: "/orders",
//     payload: {
//       // question: 'Qual a distribuição de status dos pedidos?',
//       // hostname: 'acerstore',
//       // question:
//       //   "Os pedidos da última semana com isComplete=false tem problema com transação de pagamento?",
//       // question: "Qual a distribuição de status dos pedidos da última semana?",
//       question:
//         "Quais são os 5 produtos mais vendidos esta semana e qual a taxa de cancelamento de cada um?",
//       hostname: "recorrenciacharlie",
//     },
//   })
//   // .then((response) => {
//   //   const body = JSON.parse(response.body);
//   //   console.log("--- Demo response ---");
//   //   console.log(body?.answer);
//   // })
//   .catch((error) => {
//     console.error("Error making test request:", error);
//   });

// app
//   .inject({
//     method: "GET",
//     url: "/litellm/ping",
//   })
//   .then((response) => {
//     console.log(response.body);
//   });
