import { BadRequestException } from '@nestjs/common';

/**
 * Lỗi 400 gắn với một ô của form, đúng dạng chung `{ message, fields: { tênTrường: lỗi } }` (error-codes.md mục 1).
 * Dùng cho lỗi kiểm ở service; lỗi DTO đã có `fields` từ ValidationPipe. Trường lồng nhau viết `cha.con`.
 */
export function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ message, fields: { [field]: message } });
}
