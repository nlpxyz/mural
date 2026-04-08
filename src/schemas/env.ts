import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  MURAL_API_KEY: z.string(),
  MURAL_TRANSFER_API_KEY: z.string(),
  // Vercel cron auth secret
  CRON_SECRET: z.string(),
  MERCHANT_API_KEY: z.string(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Fetch all the environment variables
 */
export function getEnv(): Env {
  return envSchema.parse(process.env);
}
