import { AsyncLocalStorage } from 'async_hooks';

/** Dữ liệu của request HTTP đang chạy, để tầng dưới (audit) lấy mà không phải truyền qua mọi hàm. Job, worker: không có. */
export interface RequestContext {
  traceId: string;
  ip: string | null;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function currentRequest(): RequestContext | undefined {
  return requestContext.getStore();
}
