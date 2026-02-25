export const JWT_SECRET_KEY = 'JWT_SECRET';
export const JWT_ACCESS_TTL_KEY = 'JWT_ACCESS_TTL';
export const JWT_REFRESH_TTL_KEY = 'JWT_REFRESH_TTL';

/** Defaults (overridable via .env) */
export const DEFAULT_ACCESS_TTL = '15m';
export const DEFAULT_REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const REFRESH_COOKIE_NAME = 'refresh_token';
