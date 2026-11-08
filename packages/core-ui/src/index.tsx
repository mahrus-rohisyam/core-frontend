import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  /** Disables the button and shows a spinner. */
  busy?: boolean;
}

export function Button({ variant = "primary", busy = false, type = "button", disabled, children, ...rest }: ButtonProps) {
  return (
    <button {...rest} type={type} className="ui-button" data-variant={variant} disabled={disabled || busy} aria-busy={busy || undefined}>
      {busy && <Spinner />}
      {children}
    </button>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | undefined;
}

function useFieldIds(error: string | undefined, hint: string | undefined) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return { id, describedBy };
}

function FieldText({ id, hint, error }: { id: string; hint?: string | undefined; error?: string | undefined }) {
  return (
    <>
      {hint && <span id={`${id}-hint`} className="ui-field-hint">{hint}</span>}
      {error && <span id={`${id}-error`} className="ui-field-error" role="alert">{error}</span>}
    </>
  );
}

export type TextFieldProps = FieldProps & InputHTMLAttributes<HTMLInputElement>;

/** A labeled input. The error is announced and linked to the input with aria-describedby. */
export function TextField({ label, hint, error, ...input }: TextFieldProps) {
  const { id, describedBy } = useFieldIds(error, hint);
  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      <FieldText id={id} hint={hint} error={error} />
    </div>
  );
}

export type SelectFieldProps = FieldProps & SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
};

export function SelectField({ label, hint, error, options, ...select }: SelectFieldProps) {
  const { id, describedBy } = useFieldIds(error, hint);
  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...select}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <FieldText id={id} hint={hint} error={error} />
    </div>
  );
}

export function Checkbox({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="ui-checkbox">
      <input type="checkbox" {...input} />
      {label}
    </label>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "success" | "danger"; children: ReactNode }) {
  return (
    <div className="ui-alert" data-tone={tone} role={tone === "danger" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="ui-card">
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="ui-page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="ui-actions">{actions}</div>}
    </header>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
}

export function Table<T>({ caption, columns, rows, rowKey, empty = "Nothing here yet." }: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
}) {
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <caption className="ui-visually-hidden">{caption}</caption>
        <thead>
          <tr>{columns.map((c) => <th key={c.header} scope="col">{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)}>{columns.map((c) => <td key={c.header}>{c.cell(r)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A modal dialog on the native <dialog> element, which traps focus, closes on Escape and
 * returns focus to the element that opened it.
 */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="ui-dialog" aria-labelledby={titleId} onClose={onClose}>
      {open && (
        <>
          <h2 id={titleId}>{title}</h2>
          {children}
        </>
      )}
    </dialog>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="ui-badge">{children}</span>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="ui-empty">{children}</div>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span role={label ? "status" : undefined}>
      <span className="ui-spinner" aria-hidden="true" />
      {label && <span className="ui-visually-hidden">{label}</span>}
    </span>
  );
}
