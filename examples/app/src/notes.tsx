import { useState } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@mahrus-rohisyam/core-api";
import { fieldError, FormError } from "@mahrus-rohisyam/core-auth";
import { useCan, useOrg } from "@mahrus-rohisyam/core-shell";
import { Button, Card, PageHeader, Spinner, Table, TextField } from "@mahrus-rohisyam/core-ui";
import { api } from "./api.js";

const notesQuery = (org: string) =>
  queryOptions({
    queryKey: ["orgs", org, "notes"],
    queryFn: () => unwrap(api.GET("/api/v1/orgs/{org}/notes", { params: { path: { org } } })),
  });

export function NotesPage() {
  const org = useOrg();
  const canWrite = useCan("notes.write");
  const qc = useQueryClient();
  const notes = useQuery(notesQuery(org.id));
  const [title, setTitle] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: notesQuery(org.id).queryKey });
  const create = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/orgs/{org}/notes", { params: { path: { org: org.id } }, body: { title } })),
    onSuccess: () => {
      setTitle("");
      return refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/v1/orgs/{org}/notes/{id}", { params: { path: { org: org.id, id } } })),
    onSuccess: refresh,
  });
  return (
    <main className="shell-page">
      <PageHeader title="Notes" description={org.name} />
      <div className="shell-stack">
        {canWrite && (
          <Card title="New note">
            <form className="ui-form" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
              <FormError error={create.error} fields={["title"]} />
              <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} error={fieldError(create.error, "title")} />
              <div className="ui-actions"><Button type="submit" busy={create.isPending}>Add note</Button></div>
            </form>
          </Card>
        )}
        <FormError error={notes.error ?? remove.error} />
        {notes.isLoading ? <Spinner label="Loading notes" /> : (
          <Table
            caption="Notes"
            rows={notes.data?.items ?? []}
            rowKey={(n) => n.id}
            empty="No notes yet."
            columns={[
              { header: "Title", cell: (n) => n.title },
              { header: "Created", cell: (n) => new Date(n.created_at).toLocaleString() },
              { header: "", cell: (n) => canWrite && <Button variant="secondary" onClick={() => remove.mutate(n.id)}>Delete</Button> },
            ]}
          />
        )}
      </div>
    </main>
  );
}
