import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@mahrus-rohisyam/core-api";
import { fieldError, FormError, sessionKey, useCoreApi, useSession } from "@mahrus-rohisyam/core-auth";
import { Alert, Badge, Button, Card, PageHeader, Spinner, Table, TextField } from "@mahrus-rohisyam/core-ui";
import { keys } from "./data.js";

export function AccountPage() {
  const { session } = useSession();
  if (!session) return <Spinner label="Loading" />;
  return (
    <main className="shell-page">
      <PageHeader title="Account" description={session.user.email} />
      <div className="shell-stack">
        {!session.user.email_verified && <VerifyNotice />}
        <Profile name={session.user.name} />
        <ChangePassword />
        <TwoFactor enabled={session.user.totp_enabled} />
        <Sessions />
      </div>
    </main>
  );
}

function VerifyNotice() {
  const api = useCoreApi();
  const m = useMutation({ mutationFn: () => unwrap(api.POST("/api/v1/account/verify-email/resend")) });
  return (
    <Alert>
      Your email address is not confirmed yet.{" "}
      {m.isSuccess ? "We sent a new link." : <Button variant="ghost" busy={m.isPending} onClick={() => m.mutate()}>Send the link again</Button>}
    </Alert>
  );
}

function Profile({ name: initial }: { name: string }) {
  const api = useCoreApi();
  const qc = useQueryClient();
  const [name, setName] = useState(initial);
  const m = useMutation({
    mutationFn: () => unwrap(api.PATCH("/api/v1/account", { body: { name } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKey }),
  });
  return (
    <Card title="Profile">
      <form className="ui-form" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <FormError error={m.error} fields={["name"]} />
        {m.isSuccess && <Alert tone="success">Saved.</Alert>}
        <TextField label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={fieldError(m.error, "name")} />
        <div className="ui-actions"><Button type="submit" busy={m.isPending}>Save</Button></div>
      </form>
    </Card>
  );
}

function ChangePassword() {
  const api = useCoreApi();
  const qc = useQueryClient();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const m = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/account/password", { body: { current_password: current, new_password: next } })),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      return qc.invalidateQueries({ queryKey: keys.sessions });
    },
  });
  return (
    <Card title="Password">
      <form className="ui-form" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <FormError error={m.error} fields={["current_password", "new_password"]} />
        {m.isSuccess && <Alert tone="success">Password changed. Your other sessions were signed out.</Alert>}
        <TextField label="Current password" type="password" autoComplete="current-password" value={current}
          onChange={(e) => setCurrent(e.target.value)} error={fieldError(m.error, "current_password")} />
        <TextField label="New password" type="password" autoComplete="new-password" hint="At least 12 characters." value={next}
          onChange={(e) => setNext(e.target.value)} error={fieldError(m.error, "new_password")} />
        <div className="ui-actions"><Button type="submit" busy={m.isPending}>Change password</Button></div>
      </form>
    </Card>
  );
}

function TwoFactor({ enabled }: { enabled: boolean }) {
  const api = useCoreApi();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const setup = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/account/totp/setup", { body: { password } })),
    onSuccess: () => setPassword(""),
  });
  const confirm = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/account/totp/confirm", { body: { code } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKey }),
  });
  const disable = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/account/totp/disable", { body: { password } })),
    onSuccess: () => {
      setPassword("");
      setup.reset();
      confirm.reset();
      return qc.invalidateQueries({ queryKey: sessionKey });
    },
  });

  if (confirm.data) {
    return (
      <Card title="Two-factor authentication">
        <Alert tone="success">Two-factor authentication is on.</Alert>
        <p>Save these recovery codes somewhere safe. Each works once if you lose your device. They are not shown again.</p>
        <ul className="shell-codes">{confirm.data.recovery_codes.map((c) => <li key={c} className="ui-mono">{c}</li>)}</ul>
      </Card>
    );
  }
  if (enabled) {
    return (
      <Card title="Two-factor authentication">
        <p><Badge>On</Badge> Signing in needs a code from your authenticator app.</p>
        <form className="ui-form" onSubmit={(e) => { e.preventDefault(); disable.mutate(); }}>
          <FormError error={disable.error} fields={["password"]} />
          <TextField label="Password" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} error={fieldError(disable.error, "password")} />
          <div className="ui-actions"><Button type="submit" variant="danger" busy={disable.isPending}>Turn off</Button></div>
        </form>
      </Card>
    );
  }
  return (
    <Card title="Two-factor authentication">
      {!setup.data ? (
        <form className="ui-form" onSubmit={(e) => { e.preventDefault(); setup.mutate(); }}>
          <p>Ask for a code from an authenticator app when you sign in.</p>
          <FormError error={setup.error} fields={["password"]} />
          <TextField label="Password" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} error={fieldError(setup.error, "password")} />
          <div className="ui-actions"><Button type="submit" busy={setup.isPending}>Set up</Button></div>
        </form>
      ) : (
        <form className="ui-form" onSubmit={(e) => { e.preventDefault(); confirm.mutate(); }}>
          <p>Add this key to your authenticator app, or open the link on the device that has the app.</p>
          <p className="ui-mono">{setup.data.secret}</p>
          <p><a href={setup.data.otpauth_url}>Open in authenticator app</a></p>
          <FormError error={confirm.error} fields={["code"]} />
          <TextField label="Code from the app" autoComplete="one-time-code" inputMode="numeric" value={code}
            onChange={(e) => setCode(e.target.value)} error={fieldError(confirm.error, "code")} />
          <div className="ui-actions"><Button type="submit" busy={confirm.isPending}>Turn on</Button></div>
        </form>
      )}
    </Card>
  );
}

function Sessions() {
  const api = useCoreApi();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: keys.sessions, queryFn: () => unwrap(api.GET("/api/v1/account/sessions")) });
  const done = () => qc.invalidateQueries({ queryKey: keys.sessions });
  const revoke = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/v1/account/sessions/{id}", { params: { path: { id } } })),
    onSuccess: done,
  });
  const others = useMutation({ mutationFn: () => unwrap(api.POST("/api/v1/account/sessions/revoke-others")), onSuccess: done });
  return (
    <Card title="Where you are signed in">
      <FormError error={list.error ?? revoke.error ?? others.error} />
      {list.data && (
        <Table
          caption="Sessions"
          rows={list.data.items}
          rowKey={(s) => s.id}
          columns={[
            { header: "Device", cell: (s) => <>{s.user_agent || "Unknown"} {s.current && <Badge>This device</Badge>}</> },
            { header: "IP address", cell: (s) => s.ip },
            { header: "Last active", cell: (s) => new Date(s.last_seen_at).toLocaleString() },
            { header: "", cell: (s) => !s.current && <Button variant="secondary" onClick={() => revoke.mutate(s.id)}>Sign out</Button> },
          ]}
        />
      )}
      <div className="ui-actions">
        <Button variant="secondary" busy={others.isPending} onClick={() => others.mutate()}>Sign out everywhere else</Button>
      </div>
    </Card>
  );
}
