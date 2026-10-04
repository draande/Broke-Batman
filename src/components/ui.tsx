"use client";
import { brand } from "@/lib/brand";
import * as Dialog from "@radix-ui/react-dialog";
import { cloneElement, isValidElement, useId } from "react";
import { X, Radar } from "lucide-react";
import type { Status } from "@/types/domain";
export function Mark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path d={brand.markPath} fill="currentColor" />
      <path d="M16 23L22 25M26 25L32 23" stroke="var(--bg)" strokeWidth="2.5" />
    </svg>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className={`modal ${wide ? "wide" : ""}`}>
          <div className="modal-head">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {description || "Manage your job search information."}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Badge({
  status,
}: {
  status: Pick<Status, "label" | "category">;
}) {
  return (
    <span className={`badge ${status.category}`}>
      <i />
      {status.label}
    </span>
  );
}
export function Empty({
  title = "Even Batman had to start somewhere.",
  text = "Add your first case and take control of the search.",
  action,
}: {
  title?: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Radar size={36} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement<Record<string, unknown>>(children)
        ? cloneElement(children, {
            id,
            "aria-describedby": hint ? `${id}-hint` : undefined,
          })
        : children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Skeleton() {
  return (
    <div
      className="skeleton-grid"
      aria-label="Loading dashboard"
      aria-busy="true"
    >
      {Array.from({ length: 8 }, (_, i) => (
        <div className="skeleton" key={i} />
      ))}
    </div>
  );
}
