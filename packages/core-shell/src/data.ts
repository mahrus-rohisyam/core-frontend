import { useQuery } from "@tanstack/react-query";
import { unwrap, type Schemas } from "@mahrus-rohisyam/core-api";
import { useAuthConfig, useCoreApi } from "@mahrus-rohisyam/core-auth";

export type Org = Schemas["Org"];
export type Member = Schemas["Member"];
export type Role = Schemas["Role"];
export type Invitation = Schemas["Invitation"];
export type ApiToken = Schemas["APIToken"];
export type AuditEvent = Schemas["AuditEvent"];
export type Permission = Schemas["Permission"];

/** Query keys of the core data. Invalidate ["orgs", orgId] after a change in an organization. */
export const keys = {
  orgs: ["orgs"] as const,
  org: (org: string) => ["orgs", org] as const,
  members: (org: string) => ["orgs", org, "members"] as const,
  roles: (org: string) => ["orgs", org, "roles"] as const,
  invitations: (org: string) => ["orgs", org, "invitations"] as const,
  tokens: (org: string) => ["orgs", org, "api-tokens"] as const,
  audit: (org: string) => ["orgs", org, "audit-events"] as const,
  permissions: ["permissions"] as const,
  sessions: ["account", "sessions"] as const,
};

export function useOrgs() {
  const api = useCoreApi();
  return useQuery({ queryKey: keys.orgs, queryFn: () => unwrap(api.GET("/api/v1/orgs")) });
}

/** The organization, with the caller's role and permissions in it. */
export function useOrgQuery(org: string) {
  const api = useCoreApi();
  return useQuery({ queryKey: keys.org(org), queryFn: () => unwrap(api.GET("/api/v1/orgs/{org}", { params: { path: { org } } })) });
}

export function usePermissions() {
  const api = useCoreApi();
  return useQuery({ queryKey: keys.permissions, queryFn: () => unwrap(api.GET("/api/v1/permissions")), staleTime: Infinity });
}

export function useRoles(org: string) {
  const api = useCoreApi();
  return useQuery({ queryKey: keys.roles(org), queryFn: () => unwrap(api.GET("/api/v1/orgs/{org}/roles", { params: { path: { org } } })) });
}

export function useIsMulti(): boolean {
  return useAuthConfig().data?.tenancy === "multi";
}
