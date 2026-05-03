import { describe, it, after, before } from "node:test";
import assert from "node:assert";
import { Client } from "@modelcontextprotocol/sdk/client";
import { createTestClient } from "./helpers";

async function encryptMessage(
  client: Client,
  message: string,
  encryptionKey: string,
) {
  const result = (await client.callTool({
    name: "encrypt_message",
    arguments: {
      message,
      encryptionKey,
    },
  })) as unknown as {
    structuredContent: {
      encryptedMessage: string;
    };
  };

  return result;
}

describe("MCP Tool Tests", () => {
  let client: Client;
  let encryptionKey = "my-super-passphrase";

  before(async () => {
    client = await createTestClient();
  });

  after(async () => {
    await client.close();
  });

  it("should encrypt a message", async () => {
    const message = "Hello, world!";
    const result = await encryptMessage(client, message, encryptionKey);
    assert.ok(
      result.structuredContent.encryptedMessage.length > 60,
      "Encrypted message should be longer than 60 characters",
    );
  });

  it.todo("should decrypt a message", async () => {});
});
