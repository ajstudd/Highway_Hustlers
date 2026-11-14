import { digest } from './security.mjs';
import { emailOf } from './member-state.mjs';

// Administrator Google accounts come only from the server environment
// (ADMIN_EMAILS, comma-separated). Keeping the list out of the database means a
// dashboard session or a database write can never grant administrator access.
export function adminEmails(env) {
  return new Set(String(env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean).flatMap(s => { try { return [emailOf(s)]; } catch { return []; } }));
}
export const passwordCredential = env => digest(env.ADMIN_PASSWORD_HASH);
// Bound to the email and the password hash: removing an email from
// ADMIN_EMAILS, or rotating the password, ends that administrator's sessions.
export const googleAdminCredential = (env, email) => digest(`google-admin\n${email}\n${env.ADMIN_PASSWORD_HASH}`);
export const adminCredentials = env => [passwordCredential(env), ...[...adminEmails(env)].map(email => googleAdminCredential(env, email))];
