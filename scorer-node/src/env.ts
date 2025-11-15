// Legacy shim: prefer importing from src/config/index.ts directly.
import config, { SERVER, PROVIDERS } from "./config/index.js";

export const ENV = {
  PORT: SERVER.port,
  OPENAI_API_KEY: PROVIDERS.openai.apiKey,
  CORS_ORIGINS: SERVER.corsOrigins,
  RATE_LIMIT_PER_MIN: SERVER.rateLimitPerMin,
};

export default config;
