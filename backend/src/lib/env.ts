function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return requireEnv("SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return requireEnv("SUPABASE_ANON_KEY");
  },
  get supabaseServiceRoleKey() {
    return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  },
  get port() {
    return Number(process.env.PORT ?? 3000);
  },
  /** Comma-separated allowed origins for the frontend; defaults to the local Vite dev server. */
  get corsOrigins() {
    const raw = process.env.FRONTEND_ORIGIN;
    return raw ? raw.split(",").map((origin) => origin.trim()) : ["http://localhost:5173"];
  },
};
