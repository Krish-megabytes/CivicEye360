import type { Role } from '../domain/constants.js';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      name: string;
      email: string;
      role: Role;
      departmentIds: string[];
    }

    interface Request {
      user?: AuthUser;
      requestId?: string;
    }
  }
}

export {};
