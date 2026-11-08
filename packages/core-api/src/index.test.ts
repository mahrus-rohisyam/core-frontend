import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient, setCsrfToken, setUnauthorizedHandler, unwrap } from "./index.js";

function fakeFetch(status: number, body: unknown, contentType = "application/json") {
  return vi.fn(async (_req: Request) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": contentType } }),
  );
}

afterEach(() => {
  setCsrfToken("");
  setUnauthorizedHandler(undefined);
});

describe("createApiClient", () => {
  it("sends the CSRF token on changes only", async () => {
    const f = fakeFetch(200, { items: [] });
    const api = createApiClient({ baseUrl: "http://app.test", fetch: f });
    setCsrfToken("tok");
    await api.GET("/api/v1/orgs");
    await api.POST("/api/v1/orgs", { body: { name: "Acme" } });
    const [get, post] = f.mock.calls.map((c) => c[0]);
    expect(get?.headers.get("X-CSRF-Token")).toBeNull();
    expect(post?.headers.get("X-CSRF-Token")).toBe("tok");
    expect(post?.credentials).toBe("same-origin");
  });

  it("reports an expired session, but not a failed sign-in", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    const problem = { type: "/problems/unauthorized", title: "Sign in to continue", status: 401 };
    await createApiClient({ baseUrl: "http://app.test", fetch: fakeFetch(401, problem, "application/problem+json") }).GET("/api/v1/session");
    expect(handler).toHaveBeenCalledTimes(1);
    await createApiClient({ baseUrl: "http://app.test", fetch: fakeFetch(401, problem, "application/problem+json") }).POST(
      "/api/v1/auth/sign-in",
      { body: { email: "a@example.com", password: "x" } },
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("unwrap", () => {
  it("returns data", async () => {
    const api = createApiClient({ baseUrl: "http://app.test", fetch: fakeFetch(200, { items: [{ key: "a.b" }] }) });
    const data = await unwrap(api.GET("/api/v1/permissions"));
    expect(data.items[0]?.key).toBe("a.b");
  });

  it("throws ApiError with field errors", async () => {
    const api = createApiClient({
      baseUrl: "http://app.test",
      fetch: fakeFetch(422, {
        type: "/problems/validation",
        title: "Some fields are invalid",
        status: 422,
        errors: [{ field: "password", message: "must be at least 12 characters" }],
      }, "application/problem+json"),
    });
    const err = await unwrap(api.POST("/api/v1/auth/sign-up", { body: { email: "a@example.com", name: "A", password: "x" } })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const e = err as ApiError;
    expect(e.status).toBe(422);
    expect(e.code).toBe("validation");
    expect(e.fieldError("password")).toBe("must be at least 12 characters");
  });

  it("turns a network failure into status 0", async () => {
    const api = createApiClient({ baseUrl: "http://app.test", fetch: vi.fn(async () => { throw new TypeError("offline"); }) });
    const err = (await unwrap(api.GET("/api/v1/session")).catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(0);
  });
});
