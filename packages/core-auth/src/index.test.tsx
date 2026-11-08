import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient, type CorePaths } from "@mahrus-rohisyam/core-api";
import { RequireAuth, SessionProvider, SignInForm, SignUpForm } from "./index.js";

afterEach(cleanup);

const user = { id: "u1", email: "ada@example.com", name: "Ada", email_verified: false, is_instance_admin: false, totp_enabled: true, created_at: "2026-01-01T00:00:00Z" };

type Reply = { status: number; body?: unknown };

function setup(replies: Reply[], ui: React.ReactNode) {
  const requests: Request[] = [];
  const fetch = vi.fn(async (req: Request) => {
    requests.push(req);
    const r = replies.shift() ?? { status: 500 };
    const type = r.status >= 400 ? "application/problem+json" : "application/json";
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { "Content-Type": type } });
  });
  const api = createApiClient<CorePaths>({ baseUrl: "http://app.test", fetch });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <SessionProvider api={api}>{ui}</SessionProvider>
    </QueryClientProvider>,
  );
  return { requests };
}

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("SignInForm", () => {
  it("asks for the second factor, then signs in", async () => {
    const onSignedIn = vi.fn();
    const { requests } = setup(
      [
        { status: 401, body: { type: "/problems/mfa-required", title: "Enter the code from your authenticator app", status: 401 } },
        { status: 200, body: { user, csrf_token: "csrf-1" } },
      ],
      <SignInForm onSignedIn={onSignedIn} />,
    );
    type("Email", "ada@example.com");
    type("Password", "correct horse battery staple");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const code = await screen.findByLabelText("Authentication code");
    fireEvent.change(code, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith({ user, csrf_token: "csrf-1" }));
    expect(await requests[1]!.json()).toEqual({ email: "ada@example.com", password: "correct horse battery staple", code: "123456" });
  });

  it("shows a wrong password", async () => {
    setup([{ status: 401, body: { type: "/problems/invalid-credentials", title: "Email or password is incorrect", status: 401 } }], <SignInForm onSignedIn={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Email or password is incorrect");
    expect(screen.queryByLabelText("Authentication code")).toBeNull();
  });
});

describe("SignUpForm", () => {
  it("shows field errors next to the fields and sends the invitation", async () => {
    const { requests } = setup(
      [{ status: 422, body: { type: "/problems/validation", title: "Some fields are invalid", status: 422, errors: [{ field: "password", message: "must be at least 12 characters" }] } }],
      <SignUpForm invitation="inv-1" email="ada@example.com" onSignedUp={() => {}} />,
    );
    type("Name", "Ada");
    type("Password", "short");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    const input = screen.getByLabelText("Password");
    await waitFor(() => expect(input.getAttribute("aria-invalid")).toBe("true"));
    expect(screen.getByText("must be at least 12 characters")).toBeTruthy();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(await requests[0]!.json()).toEqual({ name: "Ada", email: "ada@example.com", password: "short", invitation: "inv-1" });
  });
});

describe("RequireAuth", () => {
  it("shows the fallback when signed out", async () => {
    setup([{ status: 401, body: { type: "/problems/unauthorized", title: "Sign in to continue", status: 401 } }],
      <RequireAuth fallback={<p>please sign in</p>}><p>secret</p></RequireAuth>);
    expect(await screen.findByText("please sign in")).toBeTruthy();
    expect(screen.queryByText("secret")).toBeNull();
  });

  it("shows the children when signed in", async () => {
    setup([{ status: 200, body: { user, csrf_token: "c" } }], <RequireAuth fallback={<p>please sign in</p>}><p>secret</p></RequireAuth>);
    expect(await screen.findByText("secret")).toBeTruthy();
  });
});
