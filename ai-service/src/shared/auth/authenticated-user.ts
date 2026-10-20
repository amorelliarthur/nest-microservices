import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  role: string;
}

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}
