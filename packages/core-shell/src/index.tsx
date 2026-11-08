import { createContext, useContext, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Link,
  Outlet,
  redirect,
  RouterProvider,
  useNavigate,
  type AnyRoute,
} from "@tanstack/react-router";
import { unwrap, type ApiClient, type CorePaths } from "@mahrus-rohisyam/core-api";
import {
  authConfigQueryOptions,
  defaultApi,
  ForgotPasswordForm,
  FormError,
  fieldError,
  ResetPasswordForm,
  SessionProvider,
  SignInForm,
  SignUpForm,
  sessionQueryOptions,
  useAuthConfig,
  useCoreApi,
  useInvitation,
  useSession,
  useSignOut,
  VerifyEmail,
} from "@mahrus-rohisyam/core-auth";
import { Alert, Button, Card, Dialog, EmptyState, Spinner, TextField } from "@mahrus-rohisyam/core-ui";
import { keys, useIsMulti, useOrgQuery, useOrgs, type Org } from "./data.js";

export * from "./data.js";

/** A sidebar entry. `to` is relative to the organization, e.g. "notes" for /orgs/$org/notes. */
export interface NavItem {
  to: string;
  label: string;
  /** Hide the entry from people without this permission. The API still enforces it. */
  permission?: string;
}

export interface CoreAppOptions {
  /** Shown in the sidebar and the browser title. */
  appName: string;
  /** The app's own pages, added under /orgs/$org. Use `orgRoute` as their parent. */
  routes?: (orgRoute: AnyRoute) => AnyRoute[];
  nav?: NavItem[];
  /** Where the SPA is served. Must match the Go app (default "/app"). */
  basepath?: string;
  api?: ApiClient<CorePaths>;
  queryClient?: QueryClient;
}

const OrgContext = createContext<Org | null>(null);

/** The current organization and the caller's permissions in it. Use inside organization pages. */
export function useOrg(): Org {
  const org = useContext(OrgContext);
  if (!org) throw new Error("useOrg must be used inside an organization page");
  return org;
}

/** Whether the caller has a permission in the current organization. */
export function useCan(permission: string): boolean {
  return useOrg().permissions?.includes(permission) ?? false;
}

function Centered({ children }: { children: ReactNode }) {
  return <main className="shell-centered">{children}</main>;
}

/**
 * The page to open after sign-in, from the "next" search parameter. Only paths inside the app
 * are accepted, so a crafted link cannot send people to another site.
 */
export function nextParam(search: Record<string, unknown>): string {
  const next = typeof search["next"] === "string" ? search["next"] : "/";
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/";
}

/** Splits a local "next" path such as "/accept-invitation?token=x" into router options. */
function nextLocation(next: string): { to: string; search: Record<string, string> } {
  const [to = "/", query = ""] = next.split("?", 2);
  return { to, search: Object.fromEntries(new URLSearchParams(query)) };
}

const tokenSearch = (s: Record<string, unknown>) => ({ token: typeof s["token"] === "string" ? s["token"] : "" });

/**
 * Builds the router and the root component: sign-in pages, account settings, organization
 * settings, and the app's own pages under /orgs/$org.
 */
export function createCoreApp(options: CoreAppOptions) {
  const queryClient = options.queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
  const nav = options.nav ?? [];
  const api = options.api ?? defaultApi;
  const session = () => queryClient.ensureQueryData(sessionQueryOptions(api));

  const rootRoute = createRootRouteWithContext<{ appName: string }>()({
    component: Outlet,
    notFoundComponent: NotFound,
  });

  const signIn = createRoute({
    getParentRoute: () => rootRoute,
    path: "sign-in",
    validateSearch: (s: Record<string, unknown>) => ({ next: nextParam(s) }),
    beforeLoad: async ({ search }) => {
      if (await session()) throw redirect(nextLocation(search.next));
      const config = await queryClient.ensureQueryData(authConfigQueryOptions(api));
      if (config.setup_required) throw redirect({ to: "/sign-up", search: { invitation: "" } });
    },
    component: function SignInPage() {
      const { next } = signIn.useSearch();
      const navigate = useNavigate();
      const config = useAuthConfig();
      return (
        <Centered>
          <SignInForm
            onSignedIn={() => navigate(nextLocation(next))}
            footer={
              <p className="shell-links">
                <Link to="/forgot-password">Forgot your password?</Link>
                {config.data?.signup === "open" && <Link to="/sign-up" search={{ invitation: "" }}>Create an account</Link>}
              </p>
            }
          />
        </Centered>
      );
    },
  });

  const signUp = createRoute({
    getParentRoute: () => rootRoute,
    path: "sign-up",
    validateSearch: (s: Record<string, unknown>) => ({ invitation: typeof s["invitation"] === "string" ? s["invitation"] : "" }),
    component: function SignUpPage() {
      const { invitation } = signUp.useSearch();
      const navigate = useNavigate();
      const config = useAuthConfig();
      const invite = useInvitation(invitation);
      if (!config.data || (invitation && invite.isLoading)) return <Spinner label="Loading" />;
      const closed = !invitation && !config.data.setup_required && config.data.signup !== "open";
      return (
        <Centered>
          {config.data.setup_required && <Alert>Set up {config.data.app_name}: this first account becomes the administrator.</Alert>}
          {invite.data && <Alert>You were invited to join {invite.data.org_name}.</Alert>}
          {invite.isError && <Alert tone="danger">This invitation is invalid, expired or already used.</Alert>}
          {closed ? (
            <Card title="Sign-up is by invitation">
              <p>Ask someone in your organization to invite you.</p>
            </Card>
          ) : (
            <SignUpForm
              {...(invitation && invite.data ? { invitation, email: invite.data.email } : {})}
              onSignedUp={() => navigate({ to: "/" })}
              footer={<p className="shell-links"><Link to="/sign-in" search={{ next: "/" }}>I already have an account</Link></p>}
            />
          )}
        </Centered>
      );
    },
  });

  const forgot = createRoute({
    getParentRoute: () => rootRoute,
    path: "forgot-password",
    component: () => (
      <Centered>
        <ForgotPasswordForm footer={<p className="shell-links"><Link to="/sign-in" search={{ next: "/" }}>Back to sign in</Link></p>} />
      </Centered>
    ),
  });

  const reset = createRoute({
    getParentRoute: () => rootRoute,
    path: "reset-password",
    validateSearch: tokenSearch,
    component: function ResetPage() {
      const { token } = reset.useSearch();
      const navigate = useNavigate();
      return (
        <Centered>
          <ResetPasswordForm token={token} onDone={() => navigate({ to: "/sign-in", search: { next: "/" } })} />
        </Centered>
      );
    },
  });

  const verify = createRoute({
    getParentRoute: () => rootRoute,
    path: "verify-email",
    validateSearch: tokenSearch,
    component: function VerifyPage() {
      const { token } = verify.useSearch();
      return (
        <Centered>
          <VerifyEmail token={token} footer={<p className="shell-links"><Link to="/">Continue</Link></p>} />
        </Centered>
      );
    },
  });

  const acceptInvitation = createRoute({
    getParentRoute: () => rootRoute,
    path: "accept-invitation",
    validateSearch: tokenSearch,
    component: function AcceptPage() {
      const { token } = acceptInvitation.useSearch();
      return <AcceptInvitation token={token} />;
    },
  });

  const authed = createRoute({
    getParentRoute: () => rootRoute,
    id: "authed",
    beforeLoad: async ({ location }) => {
      if (!(await session())) throw redirect({ to: "/sign-in", search: { next: location.href } });
    },
    component: Outlet,
  });

  const home = createRoute({
    getParentRoute: () => authed,
    path: "/",
    beforeLoad: async () => {
      const orgs = await queryClient.ensureQueryData({ queryKey: keys.orgs, queryFn: () => unwrap(api.GET("/api/v1/orgs")) });
      const first = orgs.items[0];
      if (first) throw redirect({ to: "/orgs/$org", params: { org: first.id } });
    },
    component: NoOrganization,
  });

  const account = createRoute({
    getParentRoute: () => authed,
    path: "account",
    component: lazyRouteComponent(() => import("./account.js"), "AccountPage"),
  });

  const orgRoute = createRoute({
    getParentRoute: () => authed,
    path: "orgs/$org",
    component: function OrgLayout() {
      const { org } = orgRoute.useParams();
      return <OrgShell orgId={org} appName={options.appName} nav={nav} />;
    },
  });

  const orgHome = createRoute({
    getParentRoute: () => orgRoute,
    path: "/",
    component: function OrgHome() {
      const org = useOrg();
      return <EmptyState>Welcome to {org.name}. Pick a page on the left.</EmptyState>;
    },
  });

  const settings = createRoute({
    getParentRoute: () => orgRoute,
    path: "settings/$tab",
    component: lazyRouteComponent(() => import("./org-settings.js"), "OrgSettingsPage"),
  });

  const routeTree = rootRoute.addChildren([
    signIn,
    signUp,
    forgot,
    reset,
    verify,
    acceptInvitation,
    authed.addChildren([home, account, orgRoute.addChildren([orgHome, settings, ...(options.routes?.(orgRoute) ?? [])])]),
  ]);

  const router = createRouter({
    routeTree,
    basepath: options.basepath ?? "/app",
    context: { appName: options.appName },
    defaultPreload: "intent",
  });

  // An expired session clears the cached one; re-running the guards sends the user to sign-in.
  const onUnauthorized = () => void router.invalidate();

  function App() {
    return (
      <QueryClientProvider client={queryClient}>
        <SessionProvider api={api} onUnauthorized={onUnauthorized}>
          <RouterProvider router={router} />
        </SessionProvider>
      </QueryClientProvider>
    );
  }

  return { App, router, queryClient, orgRoute };
}

function NotFound() {
  return (
    <Centered>
      <Card title="Page not found">
        <p>This page does not exist, or you do not have access to it.</p>
        <Link to="/">Go to the start page</Link>
      </Card>
    </Centered>
  );
}

/** Shown to a signed-in user who belongs to no organization. */
function NoOrganization() {
  return (
    <Centered>
      <Card title="You are not in an organization yet">
        <p>Ask someone to invite you, or create an organization if this app allows it.</p>
        <CreateOrgButton />
      </Card>
    </Centered>
  );
}

function AcceptInvitation({ token }: { token: string }) {
  const api = useCoreApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { session, isLoading } = useSession();
  const invite = useInvitation(token);
  const accept = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/invitations/accept", { body: { token } })),
    onSuccess: async (org) => {
      await qc.invalidateQueries({ queryKey: keys.orgs });
      navigate({ to: "/orgs/$org", params: { org: org.id } });
    },
  });
  if (isLoading || invite.isLoading) return <Spinner label="Loading" />;
  if (invite.isError) {
    return <Centered><Alert tone="danger">This invitation is invalid, expired or already used.</Alert></Centered>;
  }
  const info = invite.data!;
  return (
    <Centered>
      <Card title={`Join ${info.org_name}`}>
        <p>This invitation is for {info.email}.</p>
        {session ? (
          <>
            <FormError error={accept.error} />
            <div className="ui-actions">
              <Button onClick={() => accept.mutate()} busy={accept.isPending}>Accept invitation</Button>
            </div>
          </>
        ) : (
          <div className="ui-actions">
            <Link className="ui-button" to="/sign-up" search={{ invitation: token }}>Create an account</Link>
            <Link className="ui-button" data-variant="secondary" to="/sign-in" search={{ next: `/accept-invitation?token=${encodeURIComponent(token)}` }}>
              Sign in
            </Link>
          </div>
        )}
      </Card>
    </Centered>
  );
}

function OrgShell({ orgId, appName, nav }: { orgId: string; appName: string; nav: NavItem[] }) {
  const org = useOrgQuery(orgId);
  const { session } = useSession();
  const navigate = useNavigate();
  const signOut = useSignOut(() => navigate({ to: "/sign-in", search: { next: "/" } }));
  const [menuOpen, setMenuOpen] = useState(false);
  if (org.isLoading) return <Spinner label="Loading" />;
  if (!org.data) return <NotFound />;
  const can = (p?: string) => !p || (org.data.permissions ?? []).includes(p);
  const settingsTabs = settingsNav.filter((t) => can(t.permission));
  return (
    <OrgContext.Provider value={org.data}>
      <div className="shell" data-menu-open={menuOpen || undefined}>
        <aside className="shell-sidebar">
          <div className="shell-brand">{appName}</div>
          <OrgSwitcher current={org.data} />
          <nav aria-label="Main" onClick={() => setMenuOpen(false)}>
            <ul>
              {nav.filter((n) => can(n.permission)).map((n) => (
                <li key={n.to}>
                  <Link to={`/orgs/$org/${n.to}`} params={{ org: orgId }} activeProps={{ "aria-current": "page" }}>{n.label}</Link>
                </li>
              ))}
            </ul>
            <p className="shell-nav-heading">Organization</p>
            <ul>
              {settingsTabs.map((t) => (
                <li key={t.tab}>
                  <Link to="/orgs/$org/settings/$tab" params={{ org: orgId, tab: t.tab }} activeProps={{ "aria-current": "page" }}>{t.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="shell-user">
            <Link to="/account">{session?.user.name ?? "Account"}</Link>
            <Button variant="ghost" busy={signOut.isPending} onClick={() => signOut.mutate()}>
              Sign out
            </Button>
          </div>
        </aside>
        <div className="shell-main">
          <button type="button" className="shell-menu-button" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>Menu</button>
          <Outlet />
        </div>
      </div>
    </OrgContext.Provider>
  );
}

/** Organization settings pages and the permission each needs to appear. */
export const settingsNav: { tab: string; label: string; permission?: string }[] = [
  { tab: "general", label: "General" },
  { tab: "members", label: "Members", permission: "members.read" },
  { tab: "roles", label: "Roles", permission: "members.read" },
  { tab: "invitations", label: "Invitations", permission: "members.manage" },
  { tab: "api-tokens", label: "API tokens" },
  { tab: "audit", label: "Audit log", permission: "audit.read" },
];

function OrgSwitcher({ current }: { current: Org }) {
  const orgs = useOrgs();
  const multi = useIsMulti();
  const navigate = useNavigate();
  const list = orgs.data?.items ?? [];
  if (list.length < 2 && !multi) return null;
  return (
    <div className="shell-switcher">
      <label className="ui-visually-hidden" htmlFor="org-switcher">Organization</label>
      <select id="org-switcher" value={current.id} onChange={(e) => navigate({ to: "/orgs/$org", params: { org: e.target.value } })}>
        {list.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      {multi && <CreateOrgButton />}
    </div>
  );
}

function CreateOrgButton() {
  const api = useCoreApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const multi = useIsMulti();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const m = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/orgs", { body: { name } })),
    onSuccess: async (org) => {
      await qc.invalidateQueries({ queryKey: keys.orgs });
      setOpen(false);
      setName("");
      navigate({ to: "/orgs/$org", params: { org: org.id } });
    },
  });
  if (!multi) return null;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>New organization</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New organization">
        <form className="ui-form" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <FormError error={m.error} fields={["name"]} />
          <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} error={fieldError(m.error, "name")} />
          <div className="ui-actions">
            <Button type="submit" busy={m.isPending}>Create</Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
