import "dotenv/config";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  port: parseInt(optionalEnv("PORT", "4000"), 10),
  nodeEnv: optionalEnv("NODE_ENV", "development"),

  googleApiKey: requireEnv("GOOGLE_API_KEY"),
  mem0ApiKey: process.env.MEM0_API_KEY,
  mem0SelfHostedUrl: process.env.MEM0_SELF_HOSTED_URL,

  databaseUrl: requireEnv("DATABASE_URL"),

  defaultTargetUrl: optionalEnv("DEFAULT_TARGET_URL", "http://localhost:3000"),
  dashboardSecret: process.env.DASHBOARD_SECRET,

  // JWT — use strong secrets in production
  jwtSecret: optionalEnv("JWT_SECRET", "dev-jwt-secret-change-in-production"),
  jwtRefreshSecret: optionalEnv("JWT_REFRESH_SECRET", "dev-jwt-refresh-secret-change-in-production"),
  jwtAccessExpiry: optionalEnv("JWT_ACCESS_EXPIRY", "15m"),
  jwtRefreshExpiry: optionalEnv("JWT_REFRESH_EXPIRY", "7d"),

  testUserEmail: process.env.TEST_USER_EMAIL,
  testUserPassword: process.env.TEST_USER_PASSWORD,
  testAdminEmail: process.env.TEST_ADMIN_EMAIL,
  testAdminPassword: process.env.TEST_ADMIN_PASSWORD,
  testTotpSecret: process.env.TEST_TOTP_SECRET,

  github: {
    token: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    defaultBranch: optionalEnv("GITHUB_DEFAULT_BRANCH", "main"),
    mcpUrl: optionalEnv("GITHUB_MCP_URL", "http://github-mcp:8080/sse"),
  },

  llmModel: "gemini-2.5-pro",
} as const;
