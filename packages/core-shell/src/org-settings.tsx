import { useState, type ReactNode } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { unwrap } from "@mahrus-rohisyam/core-api";
import { fieldError, FormError, useCoreApi, useSession } from "@mahrus-rohisyam/core-auth";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  PageHeader,
  SelectField,
  Spinner,
  Table,
  TextField,
} from "@mahrus-rohisyam/core-ui";
import { keys, usePermissions, useRoles, type Role } from "./data.js";
import { settingsNav, useCan, useOrg } from "./index.js";

export function OrgSettingsPage() {
  const { tab } = useParams({ strict: false }) as { tab?: string };
  const org = useOrg();
  const page = settingsNav.find((t) => t.tab === tab);
  if (!page || (page.permission && !org.permissions?.includes(page.permission))) {
    return <Alert tone="danger">You do not have access to this page.</Alert>;
  }
  const body: Record<string, ReactNode> = {
    general: <General />,
    members: <Members />,
    roles: <Roles />,
    invitations: <Invitations />,
    "api-tokens": <ApiTokens />,
    audit: <Audit />,
  };
  return (
    <main className="shell-page">
      <PageHeader title={page.label} description={org.name} />
      <div className="shell-stack">{body[page.tab]}</div>
    </main>
  );
}

/** Invalidates everything cached for the organization after a change. */
function useRefresh() {
  const qc = useQueryClient();
  const org = useOrg();
  return () => qc.invalidateQueries({ queryKey: keys.org(org.id) });
}

function General() {
  const api = useCoreApi();
  const org = useOrg();
  const refresh = useRefresh();
  const qc = useQueryClient();
  const canManage = useCan("org.manage");
  const [name, setName] = useState(org.name);
  const m = useMutation({
    mutationFn: () => unwrap(api.PATCH("/api/v1/orgs/{org}", { params: { path: { org: org.id } }, body: { name } })),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.orgs, exact: true });
      return refresh();
    },
  });
  return (
    <Card title="Organization">
      <p>Your role: <Badge>{org.role}</Badge></p>
      {canManage && (
        <form className="ui-form" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <FormError error={m.error} fields={["name"]} />
          {m.isSuccess && <Alert tone="success">Saved.</Alert>}
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={fieldError(m.error, "name")} />
          <div className="ui-actions"><Button type="submit" busy={m.isPending}>Save</Button></div>
        </form>
      )}
      <LeaveOrg />
    </Card>
  );
}

function LeaveOrg() {
  const api = useCoreApi();
  const org = useOrg();
  const { session } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const m = useMutation({
    mutationFn: () => unwrap(api.DELETE("/api/v1/orgs/{org}/members/{user}", { params: { path: { org: org.id, user: session!.user.id } } })),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.orgs });
      navigate({ to: "/" });
    },
  });
  return (
    <div className="ui-form">
      <FormError error={m.error} />
      <div className="ui-actions">
        <Button variant="danger" busy={m.isPending} onClick={() => { if (window.confirm(`Leave ${org.name}?`)) m.mutate(); }}>
          Leave organization
        </Button>
      </div>
    </div>
  );
}

function Members() {
  const api = useCoreApi();
  const org = useOrg();
  const refresh = useRefresh();
  const { session } = useSession();
  const canManage = useCan("members.manage");
  const roles = useRoles(org.id);
  const list = useInfiniteQuery({
    queryKey: keys.members(org.id),
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      unwrap(api.GET("/api/v1/orgs/{org}/members", { params: { path: { org: org.id }, query: pageParam ? { after: pageParam } : {} } })),
    getNextPageParam: (last) => last.next || undefined,
  });
  const change = useMutation({
    mutationFn: (v: { user: string; role_id: string }) =>
      unwrap(api.PATCH("/api/v1/orgs/{org}/members/{user}", { params: { path: { org: org.id, user: v.user } }, body: { role_id: v.role_id } })),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (user: string) => unwrap(api.DELETE("/api/v1/orgs/{org}/members/{user}", { params: { path: { org: org.id, user } } })),
    onSuccess: refresh,
  });
  const roleOptions = (roles.data?.items ?? []).map((r) => ({ value: r.id, label: r.name }));
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <FormError error={list.error ?? change.error ?? remove.error} />
      {list.isLoading ? <Spinner label="Loading" /> : (
        <Table
          caption="Members"
          rows={rows}
          rowKey={(m) => m.user_id}
          columns={[
            { header: "Name", cell: (m) => m.name },
            { header: "Email", cell: (m) => m.email },
            {
              header: "Role",
              cell: (m) => canManage && m.user_id !== session?.user.id ? (
                <SelectField label={`Role of ${m.name}`} value={m.role_id} options={roleOptions}
                  onChange={(e) => change.mutate({ user: m.user_id, role_id: e.target.value })} />
              ) : m.role_name,
            },
            {
              header: "",
              cell: (m) => canManage && m.user_id !== session?.user.id && (
                <Button variant="secondary" onClick={() => { if (window.confirm(`Remove ${m.name}?`)) remove.mutate(m.user_id); }}>Remove</Button>
              ),
            },
          ]}
        />
      )}
      {list.hasNextPage && <div className="ui-actions"><Button variant="secondary" busy={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>Load more</Button></div>}
    </>
  );
}

function PermissionPicker({ value, onChange, only }: { value: string[]; onChange: (v: string[]) => void; only?: string[] | undefined }) {
  const perms = usePermissions();
  const list = (perms.data?.items ?? []).filter((p) => !only || only.includes(p.key));
  return (
    <fieldset className="shell-fieldset">
      <legend>Permissions</legend>
      {list.map((p) => (
        <Checkbox key={p.key} label={`${p.description} (${p.key})`} checked={value.includes(p.key)}
          onChange={(e) => onChange(e.target.checked ? [...value, p.key] : value.filter((k) => k !== p.key))} />
      ))}
    </fieldset>
  );
}

function Roles() {
  const api = useCoreApi();
  const org = useOrg();
  const refresh = useRefresh();
  const canManage = useCan("roles.manage");
  const roles = useRoles(org.id);
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const remove = useMutation({
    mutationFn: (role: string) => unwrap(api.DELETE("/api/v1/orgs/{org}/roles/{role}", { params: { path: { org: org.id, role } } })),
    onSuccess: refresh,
  });
  return (
    <>
      {canManage && <div className="ui-actions"><Button onClick={() => setEditing("new")}>New role</Button></div>}
      <FormError error={roles.error ?? remove.error} />
      {roles.data && (
        <Table
          caption="Roles"
          rows={roles.data.items}
          rowKey={(r) => r.id}
          columns={[
            { header: "Role", cell: (r) => <>{r.name} {r.built_in && <Badge>Built in</Badge>}</> },
            { header: "Permissions", cell: (r) => r.key === "owner" || r.key === "admin" ? "All" : r.permissions.join(", ") || "None" },
            {
              header: "",
              cell: (r) => canManage && !r.built_in && (
                <div className="ui-actions">
                  <Button variant="secondary" onClick={() => setEditing(r)}>Edit</Button>
                  <Button variant="secondary" onClick={() => { if (window.confirm(`Delete the role ${r.name}?`)) remove.mutate(r.id); }}>Delete</Button>
                </div>
              ),
            },
          ]}
        />
      )}
      {editing && <RoleDialog role={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function RoleDialog({ role, onClose }: { role: Role | null; onClose: () => void }) {
  const api = useCoreApi();
  const org = useOrg();
  const refresh = useRefresh();
  const [name, setName] = useState(role?.name ?? "");
  const [perms, setPerms] = useState<string[]>(role?.permissions ?? []);
  const m = useMutation({
    mutationFn: () => {
      const body = { name, permissions: perms };
      return role
        ? unwrap(api.PATCH("/api/v1/orgs/{org}/roles/{role}", { params: { path: { org: org.id, role: role.id } }, body }))
        : unwrap(api.POST("/api/v1/orgs/{org}/roles", { params: { path: { org: org.id } }, body }));
    },
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  return (
    <Dialog open onClose={onClose} title={role ? `Edit ${role.name}` : "New role"}>
      <form className="ui-form" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <FormError error={m.error} fields={["name", "permissions"]} />
        <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} error={fieldError(m.error, "name")} />
        <PermissionPicker value={perms} onChange={setPerms} only={org.permissions} />
        {fieldError(m.error, "permissions") && <Alert tone="danger">{fieldError(m.error, "permissions")}</Alert>}
        <div className="ui-actions">
          <Button type="submit" busy={m.isPending}>Save</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  );
}

function Invitations() {
  const api = useCoreApi();
  const org = useOrg();
  const refresh = useRefresh();
  const roles = useRoles(org.id);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const list = useQuery({
    queryKey: keys.invitations(org.id),
    queryFn: () => unwrap(api.GET("/api/v1/orgs/{org}/invitations", { params: { path: { org: org.id } } })),
  });
  const roleOptions = (roles.data?.items ?? []).filter((r) => r.key !== "owner" || org.role === "owner").map((r) => ({ value: r.id, label: r.name }));
  const invite = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/orgs/{org}/invitations", {
      params: { path: { org: org.id } },
      body: { email, role_id: roleId || roleOptions.find((r) => r.label === "Member")?.value || "" },
    })),
    onSuccess: async () => {
      await refresh();
      setOpen(false);
      setEmail("");
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/v1/orgs/{org}/invitations/{id}", { params: { path: { org: org.id, id } } })),
    onSuccess: refresh,
  });
  return (
    <>
      <div className="ui-actions"><Button onClick={() => setOpen(true)}>Invite someone</Button></div>
      <FormError error={list.error ?? revoke.error} />
      {list.data && (
        <Table
          caption="Pending invitations"
          rows={list.data.items}
          rowKey={(i) => i.id}
          empty="No pending invitations."
          columns={[
            { header: "Email", cell: (i) => i.email },
            { header: "Role", cell: (i) => i.role_name },
            { header: "Expires", cell: (i) => new Date(i.expires_at).toLocaleDateString() },
            { header: "", cell: (i) => <Button variant="secondary" onClick={() => revoke.mutate(i.id)}>Revoke</Button> },
          ]}
        />
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="Invite someone">
        <form className="ui-form" onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}>
          <FormError error={invite.error} fields={["email", "role_id"]} />
          <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={fieldError(invite.error, "email")} />
          <SelectField label="Role" options={roleOptions} value={roleId || roleOptions.find((r) => r.label === "Member")?.value || ""}
            onChange={(e) => setRoleId(e.target.value)} error={fieldError(invite.error, "role_id")} />
          <p className="ui-field-hint">We email them a link that works for 7 days.</p>
          <div className="ui-actions">
            <Button type="submit" busy={invite.isPending}>Send invitation</Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function ApiTokens() {
  const api = useCoreApi();
  const org = useOrg();
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<string[]>([]);
  const [days, setDays] = useState("90");
  const list = useQuery({
    queryKey: keys.tokens(org.id),
    queryFn: () => unwrap(api.GET("/api/v1/orgs/{org}/api-tokens", { params: { path: { org: org.id } } })),
  });
  const create = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/orgs/{org}/api-tokens", {
      params: { path: { org: org.id } },
      body: { name, permissions: perms, expires_in_days: Number(days) },
    })),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/v1/orgs/{org}/api-tokens/{id}", { params: { path: { org: org.id, id } } })),
    onSuccess: refresh,
  });
  const close = () => {
    setOpen(false);
    create.reset();
    setName("");
    setPerms([]);
  };
  return (
    <>
      <p>Tokens let scripts call the API as you, in this organization only. A token never has more access than you have.</p>
      <div className="ui-actions"><Button onClick={() => setOpen(true)}>New token</Button></div>
      <FormError error={list.error ?? revoke.error} />
      {list.data && (
        <Table
          caption="API tokens"
          rows={list.data.items}
          rowKey={(t) => t.id}
          empty="No tokens."
          columns={[
            { header: "Name", cell: (t) => t.name },
            { header: "Token", cell: (t) => <span className="ui-mono">{t.prefix}...</span> },
            { header: "Permissions", cell: (t) => t.permissions.join(", ") },
            { header: "Expires", cell: (t) => (t.expires_at ? new Date(t.expires_at).toLocaleDateString() : "Never") },
            { header: "Last used", cell: (t) => (t.last_used_at ? new Date(t.last_used_at).toLocaleString() : "Never") },
            { header: "", cell: (t) => <Button variant="secondary" onClick={() => { if (window.confirm(`Revoke ${t.name}?`)) revoke.mutate(t.id); }}>Revoke</Button> },
          ]}
        />
      )}
      <Dialog open={open} onClose={close} title="New API token">
        {create.data ? (
          <div className="ui-form">
            <Alert tone="success">Copy the token now. It is not shown again.</Alert>
            <p className="ui-mono">{create.data.token}</p>
            <div className="ui-actions"><Button onClick={close}>Done</Button></div>
          </div>
        ) : (
          <form className="ui-form" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <FormError error={create.error} fields={["name", "permissions", "expires_in_days"]} />
            <TextField label="Name" hint="What uses it, for example a deploy script" required value={name}
              onChange={(e) => setName(e.target.value)} error={fieldError(create.error, "name")} />
            <PermissionPicker value={perms} onChange={setPerms} only={org.permissions} />
            {fieldError(create.error, "permissions") && <Alert tone="danger">{fieldError(create.error, "permissions")}</Alert>}
            <SelectField label="Expires" value={days} onChange={(e) => setDays(e.target.value)}
              options={[{ value: "30", label: "In 30 days" }, { value: "90", label: "In 90 days" }, { value: "365", label: "In a year" }, { value: "0", label: "Never" }]} />
            <div className="ui-actions">
              <Button type="submit" busy={create.isPending}>Create token</Button>
              <Button variant="secondary" onClick={close}>Cancel</Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}

function Audit() {
  const api = useCoreApi();
  const org = useOrg();
  const list = useInfiniteQuery({
    queryKey: keys.audit(org.id),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      unwrap(api.GET("/api/v1/orgs/{org}/audit-events", { params: { path: { org: org.id }, query: pageParam ? { before: pageParam } : {} } })),
    getNextPageParam: (last) => last.next || undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <FormError error={list.error} />
      {list.isLoading ? <Spinner label="Loading" /> : (
        <Table
          caption="Audit log"
          rows={rows}
          rowKey={(e) => String(e.id)}
          columns={[
            { header: "When", cell: (e) => new Date(e.created_at).toLocaleString() },
            { header: "Action", cell: (e) => <span className="ui-mono">{e.action}</span> },
            { header: "Target", cell: (e) => e.target_type && `${e.target_type} ${e.target_id ?? ""}` },
            { header: "By", cell: (e) => <span className="ui-mono">{e.actor_token_id ? `token ${e.actor_token_id}` : e.actor_user_id}</span> },
            { header: "IP", cell: (e) => e.ip },
          ]}
        />
      )}
      {list.hasNextPage && <div className="ui-actions"><Button variant="secondary" busy={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>Load more</Button></div>}
    </>
  );
}
