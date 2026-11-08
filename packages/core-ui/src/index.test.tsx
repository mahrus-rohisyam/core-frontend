import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Button, Dialog, Table, TextField } from "./index.js";

afterEach(cleanup);

beforeAll(() => {
  // jsdom does not implement modal dialogs.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
});

describe("TextField", () => {
  it("links the label, hint and error to the input", () => {
    render(<TextField label="Email" hint="We never share it" error="must be a valid email address" defaultValue="x" />);
    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const described = input.getAttribute("aria-describedby")!.split(" ").map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(["We never share it", "must be a valid email address"]);
  });

  it("is valid without an error", () => {
    render(<TextField label="Name" />);
    const input = screen.getByLabelText("Name");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(input.hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("Button", () => {
  it("is disabled and busy while working, and never submits by accident", () => {
    const onClick = vi.fn();
    render(<Button busy onClick={onClick}>Save</Button>);
    const b = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.type).toBe("button");
    expect(b.getAttribute("aria-busy")).toBe("true");
  });
});

describe("Table", () => {
  it("shows the empty state without rows", () => {
    render(<Table caption="Members" columns={[{ header: "Name", cell: (r: { n: string }) => r.n }]} rows={[]} rowKey={(r) => r.n} empty="No members" />);
    expect(screen.getByText("No members")).toBeTruthy();
  });

  it("renders rows", () => {
    render(<Table caption="Members" columns={[{ header: "Name", cell: (r: { n: string }) => r.n }]} rows={[{ n: "Ada" }]} rowKey={(r) => r.n} />);
    expect(screen.getByRole("cell", { name: "Ada" })).toBeTruthy();
  });
});

describe("Dialog", () => {
  it("opens, closes and is labelled by its title", () => {
    const { rerender } = render(<Dialog open title="Invite" onClose={() => {}}>body</Dialog>);
    const d = document.querySelector("dialog")!;
    expect(d.open).toBe(true);
    expect(document.getElementById(d.getAttribute("aria-labelledby")!)?.textContent).toBe("Invite");
    rerender(<Dialog open={false} title="Invite" onClose={() => {}}>body</Dialog>);
    expect(d.open).toBe(false);
  });
});
