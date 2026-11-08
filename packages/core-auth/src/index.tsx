import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  createApiClient,
  setCsrfToken,
  setUnauthorizedHandler,
  unwrap,
  type ApiClient,
  type CorePaths,
  type Schemas,
} from "@mahrus-rohisyam/core-api";
import { Alert, Button, Card, Spinner, TextField } from "@mahrus-rohisyam/core-ui";

export type User = Schemas["User"];
export type Session = Schemas["Session"];
export type AuthConfig = Schemas["AuthConfig"];

const ApiContext = createContext<ApiClient<CorePaths> | null>(null);

/** The client for core endpoints. Inside SessionProvider it is the one passed in. */
export function useCoreApi(): ApiClient<CorePaths> {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useCoreApi must be used inside <SessionProvider>");
  return api;
}

export const sessionKey = ["session"] as const;

/**
 * Loads the session and keeps the CSRF token for later requests. Any 401 from the API clears the
 * cached session, so guards send the user back to sign-in.
 */
export function SessionProvider({ api = defaultApi, onUnauthorized, children }: {
  api?: ApiClient<CorePaths>;
  /** Called after an expired session was cleared, for example to send the user to sign-in. */
  onUnauthorized?: () => void;
  children: ReactNode;
}) {
  const qc = useQueryClient();
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setCsrfToken("");
      qc.setQueryData(sessionKey, null);
      onUnauthorized?.();
    });
    return () => setUnauthorizedHandler(undefined);
  }, [qc, onUnauthorized]);
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

/** The client SessionProvider uses when none is passed. */
export const defaultApi = createApiClient<CorePaths>();

/** The session query: the signed-in user, or null when signed out. Routers can preload it. */
export function sessionQueryOptions(api: ApiClient<CorePaths>) {
  return queryOptions({
    queryKey: sessionKey,
    queryFn: async (): Promise<Session | null> => {
      try {
        const s = await unwrap(api.GET("/api/v1/session"));
        setCsrfToken(s.csrf_token ?? "");
        return s;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

/** The signed-in user, null when signed out, undefined while loading. */
export function useSession(): { session: Session | null | undefined; isLoading: boolean } {
  const q = useQuery(sessionQueryOptions(useCoreApi()));
  return { session: q.data, isLoading: q.isLoading };
}

export function authConfigQueryOptions(api: ApiClient<CorePaths>) {
  return queryOptions({ queryKey: ["auth-config"], queryFn: () => unwrap(api.GET("/api/v1/auth/config")), staleTime: Infinity });
}

export function useAuthConfig() {
  return useQuery(authConfigQueryOptions(useCoreApi()));
}

/** Stores a session returned by sign-in or sign-up. */
function useAcceptSession() {
  const qc = useQueryClient();
  return (s: Session) => {
    setCsrfToken(s.csrf_token ?? "");
    qc.clear();
    qc.setQueryData(sessionKey, s);
  };
}

/**
 * Signs out. `leave` should move away from pages that load data (usually to sign-in); the cache
 * is cleared after it, so those pages do not refetch without a session.
 */
export function useSignOut(leave: () => Promise<unknown> | void) {
  const api = useCoreApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/auth/sign-out")),
    onSettled: async () => {
      setCsrfToken("");
      qc.setQueryData(sessionKey, null);
      await leave();
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== sessionKey[0] });
    },
  });
}

/** A form-level message for errors that are not about one field. */
export function FormError({ error, fields = [] }: { error: unknown; fields?: string[] }) {
  if (!error) return null;
  if (error instanceof ApiError) {
    if (error.fields.length > 0 && error.fields.every((f) => fields.includes(f.field))) return null;
    return <Alert tone="danger">{error.detail || error.message}</Alert>;
  }
  return <Alert tone="danger">Something went wrong. Try again.</Alert>;
}

/** The server's message for one field, if it rejected it. */
export function fieldError(error: unknown, field: string): string | undefined {
  return error instanceof ApiError ? error.fieldError(field) : undefined;
}

function useForm<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState(initial);
  const bind = (name: keyof T & string) => ({
    name,
    value: values[name],
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [name]: e.target.value })),
  });
  return { values, bind };
}

const submit = (fn: () => void) => (e: FormEvent) => {
  e.preventDefault();
  fn();
};

export function SignInForm({ onSignedIn, footer }: { onSignedIn: (s: Session) => void; footer?: ReactNode }) {
  const api = useCoreApi();
  const accept = useAcceptSession();
  const { values, bind } = useForm({ email: "", password: "", code: "" });
  const [needsCode, setNeedsCode] = useState(false);
  const m = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/auth/sign-in", { body: values })),
    onSuccess: (s) => {
      accept(s);
      onSignedIn(s);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "mfa-required") setNeedsCode(true);
    },
  });
  const askingForCode = m.error instanceof ApiError && m.error.code === "mfa-required";
  return (
    <Card title="Sign in">
      <form className="ui-form" onSubmit={submit(() => m.mutate())} noValidate>
        {!askingForCode && <FormError error={m.error} />}
        <TextField label="Email" type="email" autoComplete="username" required {...bind("email")} />
        <TextField label="Password" type="password" autoComplete="current-password" required {...bind("password")} />
        {needsCode && (
          <TextField
            label="Authentication code"
            hint="The 6-digit code from your authenticator app, or a recovery code"
            autoComplete="one-time-code"
            autoFocus
            required
            {...bind("code")}
          />
        )}
        <Button type="submit" busy={m.isPending}>Sign in</Button>
        {footer}
      </form>
    </Card>
  );
}

export function SignUpForm({ invitation, email = "", onSignedUp, footer }: {
  invitation?: string;
  email?: string;
  onSignedUp: (s: Session) => void;
  footer?: ReactNode;
}) {
  const api = useCoreApi();
  const accept = useAcceptSession();
  const { values, bind } = useForm({ name: "", email, password: "" });
  const m = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/auth/sign-up", { body: { ...values, ...(invitation ? { invitation } : {}) } })),
    onSuccess: (s) => {
      accept(s);
      onSignedUp(s);
    },
  });
  return (
    <Card title="Create your account">
      <form className="ui-form" onSubmit={submit(() => m.mutate())} noValidate>
        <FormError error={m.error} fields={["name", "email", "password"]} />
        <TextField label="Name" autoComplete="name" required error={fieldError(m.error, "name")} {...bind("name")} />
        <TextField label="Email" type="email" autoComplete="email" required readOnly={!!email} error={fieldError(m.error, "email")} {...bind("email")} />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 12 characters. A few unrelated words work well."
          required
          error={fieldError(m.error, "password")}
          {...bind("password")}
        />
        <Button type="submit" busy={m.isPending}>Create account</Button>
        {footer}
      </form>
    </Card>
  );
}

export function ForgotPasswordForm({ footer }: { footer?: ReactNode }) {
  const api = useCoreApi();
  const { values, bind } = useForm({ email: "" });
  const m = useMutation({ mutationFn: () => unwrap(api.POST("/api/v1/auth/password-reset", { body: values })) });
  return (
    <Card title="Reset your password">
      {m.isSuccess ? (
        <Alert tone="success">If an account uses {values.email}, we sent it a link to choose a new password. The link expires in 1 hour.</Alert>
      ) : (
        <form className="ui-form" onSubmit={submit(() => m.mutate())} noValidate>
          <FormError error={m.error} />
          <TextField label="Email" type="email" autoComplete="email" required {...bind("email")} />
          <Button type="submit" busy={m.isPending}>Send link</Button>
        </form>
      )}
      {footer}
    </Card>
  );
}

export function ResetPasswordForm({ token, onDone }: { token: string; onDone: () => void }) {
  const api = useCoreApi();
  const { values, bind } = useForm({ password: "" });
  const m = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/auth/password-reset/confirm", { body: { token, password: values.password } })),
    onSuccess: onDone,
  });
  return (
    <Card title="Choose a new password">
      <form className="ui-form" onSubmit={submit(() => m.mutate())} noValidate>
        <FormError error={m.error} fields={["password"]} />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 12 characters. You will be signed out everywhere."
          required
          error={fieldError(m.error, "password")}
          {...bind("password")}
        />
        <Button type="submit" busy={m.isPending}>Save password</Button>
      </form>
    </Card>
  );
}

/**
 * Confirms an email address. It waits for a click instead of posting on load, because email
 * scanners open links before the person does.
 */
export function VerifyEmail({ token, footer }: { token: string; footer?: ReactNode }) {
  const api = useCoreApi();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/auth/verify-email", { body: { token } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKey }),
  });
  return (
    <Card title="Confirm your email">
      {m.isSuccess ? (
        <Alert tone="success">Your email address is confirmed.</Alert>
      ) : (
        <>
          <FormError error={m.error} />
          <div className="ui-actions">
            <Button onClick={() => m.mutate()} busy={m.isPending}>Confirm my email</Button>
          </div>
        </>
      )}
      {footer}
    </Card>
  );
}

export interface InvitationInfo {
  org_name: string;
  email: string;
}

export function useInvitation(token: string) {
  const api = useCoreApi();
  return useQuery({
    queryKey: ["invitation", token],
    queryFn: () => unwrap(api.POST("/api/v1/invitations/lookup", { body: { token } })),
    retry: false,
    enabled: token !== "",
  });
}

/** Guards children: shows `fallback` (usually a redirect to sign-in) when signed out. */
export function RequireAuth({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const { session, isLoading } = useSession();
  if (isLoading) return <Spinner label="Loading" />;
  return <>{session ? children : fallback}</>;
}
