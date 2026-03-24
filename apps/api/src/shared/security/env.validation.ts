type EnvMap = Record<string, string | undefined>;

function normalizeBooleanFlag(value: string | undefined): 'true' | 'false' {
  return value === 'true' ? 'true' : 'false';
}

export function validateEnv(env: EnvMap): EnvMap {
  const jwtSecret = env.JWT_SECRET?.trim();

  if (!jwtSecret) {
    throw new Error('JWT_SECRET est obligatoire');
  }

  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET doit contenir au moins 32 caracteres');
  }

  return {
    ...env,
    JWT_SECRET: jwtSecret,
    ENABLE_DEBUG_ROUTES: normalizeBooleanFlag(env.ENABLE_DEBUG_ROUTES),
    ENABLE_SWAGGER: normalizeBooleanFlag(env.ENABLE_SWAGGER),
  };
}
