import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { z } from "zod/v3";
import { encrypt, decrypt } from "./service.ts";


export const server = new McpServer({
  name: "Encryption Service",
  description: "A simple encryption and decryption service using AES-256-CBC.",
  version: "0.0.1",
});
