import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { AuthUser, Role } from './roles';

export const IS_PUBLIC = 'isPublic';
export const REQUIRED_ROLES = 'requiredRoles';

/** Bỏ qua xác thực (chỉ dùng cho health check). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Chỉ cho phép người có ít nhất một trong các role. Kiểm tra theo dữ liệu (ví dụ "chỉ hồ sơ của mình") vẫn nằm trong service. */
export const Roles = (...roles: Role[]) => SetMetadata(REQUIRED_ROLES, roles);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
