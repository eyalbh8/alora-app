import { Request } from 'express';

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
};

export type AuthRequest = Request & {
  user?: AuthUser;
  tenantId?: string;
};
