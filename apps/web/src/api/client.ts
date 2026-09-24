import { API_URL } from '../config';

export type ApiErrorKind = 'network' | 'http' | 'parse' | 'aborted' | 'unexpected';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly code: string,
    message: string,
    readonly status: number | null = null,
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  ifMatch?: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  etag: string | null;
  retryAfterMs: number | null;
}

const MESSAGES: Partial<Record<string, string>> = {
  GRAPH_VERSION_CONFLICT:
    'Граф на сервере изменился. Ваши правки остались здесь: загрузите версию сервера или перезапишите её своей.',
  GRAPH_CHANGED: 'Граф изменился перед запуском. Запустите генерацию ещё раз.',
  GENERATION_IN_PROGRESS: 'У этого генератора уже идёт генерация. Дождитесь результата.',
  SPACE_NOT_FOUND: 'Пространство не найдено. Вернитесь к списку и выберите другое.',
};

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const response = await send(apiUrl(path), buildInit(options));
  return parseResponse<T>(response, options.signal);
}

function buildInit({ method = 'GET', body, ifMatch, idempotencyKey, signal }: RequestOptions) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (ifMatch) headers['If-Match'] = ifMatch;
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  return {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  } satisfies RequestInit;
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw transportError(error, init.signal);
  }
}

async function parseResponse<T>(response: Response, signal?: AbortSignal): Promise<ApiResponse<T>> {
  const requestId = response.headers.get('X-Request-Id');
  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    throw transportError(error, signal);
  }
  const payload = parseJson(text);
  if (!response.ok) throw httpError(response.status, payload, requestId);
  if (payload === INVALID_JSON || payload === undefined)
    throw new ApiError(
      'parse',
      payload === undefined ? 'EMPTY_RESPONSE' : 'INVALID_JSON',
      'Сервер вернул ответ в неожиданном формате. Повторите попытку.',
      response.status,
      requestId,
    );

  const retryAfter = Number(response.headers.get('Retry-After'));
  return {
    data: payload as T,
    status: response.status,
    etag: response.headers.get('ETag'),
    retryAfterMs: retryAfter > 0 ? retryAfter * 1000 : null,
  };
}

const INVALID_JSON = Symbol('invalid json');

function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return INVALID_JSON;
  }
}

function httpError(status: number, payload: unknown, requestId: string | null): ApiError {
  const error = (payload as { error?: { code?: unknown; message?: unknown } } | undefined)?.error;
  const code = typeof error?.code === 'string' ? error.code : `HTTP_${status}`;
  const serverMessage = typeof error?.message === 'string' ? error.message : null;
  const message =
    MESSAGES[code] ??
    (status >= 500 || !serverMessage
      ? `Сервер ответил ошибкой ${status}. Повторите попытку позже.`
      : serverMessage);
  return new ApiError('http', code, message, status, requestId);
}

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

const abortedError = () => new ApiError('aborted', 'ABORTED', 'Запрос отменён.');

function transportError(error: unknown, signal: AbortSignal | null | undefined): ApiError {
  if (signal?.aborted || isAbortError(error)) return abortedError();
  return new ApiError(
    'network',
    'NETWORK_ERROR',
    'Нет связи с сервером. Проверьте, что API запущен, и повторите.',
  );
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAbortError(error)) return abortedError();
  console.error(error);
  return new ApiError('unexpected', 'UNEXPECTED', 'Что-то пошло не так. Обновите страницу.');
}

export const isAborted = (error: unknown) =>
  error instanceof ApiError ? error.kind === 'aborted' : isAbortError(error);

export const isTransient = (error: unknown) =>
  error instanceof ApiError &&
  (error.kind === 'network' || (error.kind === 'http' && (error.status ?? 0) >= 500));

export function requireETag(response: ApiResponse<unknown>): string {
  if (response.etag) return response.etag;
  throw new ApiError('parse', 'MISSING_ETAG', 'Сервер не вернул версию графа.', response.status);
}
