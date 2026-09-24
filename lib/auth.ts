export type Role = 'Product';

export interface Session {
  name: string;
  email: string;
  role: Role;
}

export function encodeSession(session: Session): string {
  return Buffer.from(JSON.stringify(session)).toString('base64');
}

export const VALID_ROLES: Role[] = ['Product'];

export function roleToPath(_role: Role): string {
  return '/dashboard';
}

export function nameFromEmail(email: string): string {
  const local = email.split('@')[0];
  return local
    .split(/[._-]/)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}
