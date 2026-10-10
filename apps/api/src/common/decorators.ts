import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";

export const IS_PUBLIC = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = "roles";
/** Any of the listed roles grants access. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES, roles);

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  locale: string;
  departmentId: string | null;
  roles: string[];
  emailEnabled: boolean;
  outOfOffice: boolean;
  mustChangePassword: boolean;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});
