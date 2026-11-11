import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  role: string;
  // Signed by auth; forwarded as-is when calling other internal services
  internalToken: string;
}

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}
