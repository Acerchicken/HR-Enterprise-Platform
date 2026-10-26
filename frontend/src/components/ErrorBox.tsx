import { ApiError } from '../api/client';

export function ErrorBox({ error }: { error: Error | null }) {
  if (!error) return null;
  const trace = error instanceof ApiError && error.traceId ? ` (traceId: ${error.traceId})` : '';
  return <p className="error">{error.message}{trace}</p>;
}
