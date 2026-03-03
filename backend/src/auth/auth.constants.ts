export const JWT_SECRET_KEY = 'JWT_SECRET';
export const JWT_ACCESS_TTL_KEY = 'JWT_ACCESS_TTL';
export const JWT_REFRESH_TTL_KEY = 'JWT_REFRESH_TTL';

/** Defaults (overridable via .env) */
export const DEFAULT_ACCESS_TTL = '15m';
export const DEFAULT_REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/** "Lembrar-me" — sessao longa (30 dias) */
export const REMEMBER_ME_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/** Sessao curta quando NAO marca "lembrar-me" (1 dia) */
export const SESSION_TTL_SECONDS = 24 * 60 * 60; // 1 day

export const REFRESH_COOKIE_NAME = 'refresh_token';
