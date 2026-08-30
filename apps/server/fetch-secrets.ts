#!/usr/bin/env ts-node
/**
 * Fetch secrets from AWS Secrets Manager into .env.<stage>
 * Usage: npm run fetch-secrets:prod
 *
 * Expects secret named `menchly-{stage}` in us-east-1 (override with AWS_REGION).
 * Required keys: DATABASE_URL, DESCOPE_PROJECT_ID
 * Optional: SOURCE_API_BASE, SOURCE_API_KEY, MCP_URL, MCP_API_KEY, ALLOWED_ORIGIN
 */
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import fs from "fs";
import path from "path";

const stage = process.env.STAGE || process.argv[2] || "prod";
const secretName = `menchly-${stage}`;
const region = process.env.AWS_REGION || "us-east-1";

async function fetchSecrets() {
  const client = new SecretsManagerClient({ region });
  const command = new GetSecretValueCommand({ SecretId: secretName });

  try {
    const response = await client.send(command);
    if (!response.SecretString) {
      throw new Error("SecretString is empty");
    }

    const secretJson = JSON.parse(response.SecretString) as Record<
      string,
      string
    >;
    const envLines = Object.entries(secretJson).map(
      ([key, value]) => `${key}=${value}`,
    );
    const envFilePath = path.resolve(process.cwd(), `.env.${stage}`);

    fs.writeFileSync(envFilePath, envLines.join("\n"));
    console.log(
      `✅ .env file generated for stage '${stage}' at ${envFilePath}`,
    );
  } catch (err) {
    console.error("❌ Failed to fetch secrets:", err);
    process.exit(1);
  }
}

void fetchSecrets();
