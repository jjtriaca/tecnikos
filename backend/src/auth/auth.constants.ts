export const JWT_SECRET_KEY = 'JWT_SECRET';
export const JWT_ACCESS_TTL_KEY = 'JWT_ACCESS_TTL';
export const JWT_REFRESH_TTL_KEY = 'JWT_REFRESH_TTL';

/** Defaults (overridable via .env) */
export const DEFAULT_ACCESS_TTL = '15m';
export const DEFAULT_REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/** TTL da sessao no banco (1 dia) — cookie e de sessao (sem maxAge, expira ao fechar browser) */
export const SESSION_TTL_SECONDS = 24 * 60 * 60; // 1 day

/** TTL do refresh token do portal do tecnico — PWA precisa de sessao longa */
export const TECH_REFRESH_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

/** TTL do device token — vincula dispositivo ao tecnico */
export const DEVICE_TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60; // 365 days

export const REFRESH_COOKIE_NAME = 'refresh_token';
