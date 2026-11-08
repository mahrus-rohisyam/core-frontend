import createClient, { type Client, type Middleware } from "openapi-fetch";
import type { components, paths } from "./schema.js";

export type { components, paths as CorePaths };
export type Schemas = components["schemas"];

/** One invalid input field from a 422 response. */
export interface FieldError {
  field: string;
  message: string;
}

/** An error response from the API (application/problem+json), or a network failure (status 0). */
export class ApiError extends Error {
  readonly status: number;
  readonly type: string;
  readonly detail: string;
  readonly fields: FieldError[];

  constructor(status: number, body: unknown) {
    const p = (body ?? {}) as { type?: string; title?: string; detail?: string; errors?: FieldError[] };
    super(p.title ?? (status === 0 ? "Could not reach the server" : `Request failed (${status})`));
    this.name = "ApiError";
    this.status = status;
    this.type = p.type ?? "";
    this.detail = p.detail ?? "";
    this.fields = p.errors ?? [];
  }

  /** The problem type without the /problems/ prefix, e.g. "validation" or "mfa-required". */
  get code(): string {
    return this.type.replace(/^\/problems\//, "");
  }

  /** The message for one field, if the server rejected it. */
  fieldError(field: string): string | undefined {
    return this.fields.find((f) => f.field === field)?.message;
  }
}

// The CSRF token belongs to the browser session, so one value serves every client on the page.
// It lives in memory only; GET /api/v1/session returns it again after a reload.
let csrfToken = "";
let onUnauthorized: (() => void) | undefined;

/** Stores the CSRF token sent with every state-changing request. */
export function setCsrfToken(token: string): void {
  csrfToken = token;
}

/** Registers what happens when a request gets 401, for example clearing the cached session. */
export function setUnauthorizedHandler(fn: (() => void) | undefined): void {
  onUnauthorized = fn;
}

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

const coreMiddleware: Middleware = {
  onRequest({ request }) {
    if (csrfToken && !safeMethods.has(request.method)) {
      request.headers.set("X-CSRF-Token", csrfToken);
    }
    return request;
  },
  onResponse({ response, request }) {
    // Signing in with a wrong password is a 401 too; that is not an expired session.
    if (response.status === 401 && !new URL(request.url).pathname.startsWith("/api/v1/auth/")) {
      onUnauthorized?.();
    }
    return response;
  },
};

export type ApiClient<P extends {}> = Client<P, `${string}/${string}`>;

/**
 * Creates a typed client for the API. Pass the paths type generated from the app's OpenAPI
 * description; the default covers the core endpoints. Requests go to the same origin, with the
 * session cookie and the CSRF header.
 */
export function createApiClient<P extends {} = paths>(
  options: { baseUrl?: string; fetch?: (request: Request) => Promise<Response> } = {},
): ApiClient<P> {
  const client = createClient<P>({
    baseUrl: options.baseUrl ?? "",
    credentials: "same-origin",
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  client.use(coreMiddleware);
  return client as ApiClient<P>;
}

/**
 * Returns the data of an openapi-fetch result, or throws ApiError. Use it in query and mutation
 * functions:
 *
 *   queryFn: () => unwrap(api.GET("/api/v1/orgs"))
 */
export async function unwrap<T>(
  result: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let r: Awaited<typeof result>;
  try {
    r = await result;
  } catch {
    throw new ApiError(0, undefined);
  }
  if (!r.response.ok) {
    throw new ApiError(r.response.status, r.error);
  }
  return r.data as T;
}
