"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { api, timeLabel, errorMessage } from "@/lib/client";
import { Modal } from "@/components/ui";
type Notice = {
  id: string;
  title: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};
export function NotificationCenter({
  notify,
}: {
  notify: (m: string, e?: boolean) => void;
}) {
  const [items, setItems] = useState<Notice[]>([]),
    [open, setOpen] = useState(false);
  const reload = useCallback(
    () =>
      api<Notice[]>("notifications")
        .then(setItems)
        .catch((e) => notify(e.message, true)),
    [notify],
  );
  useEffect(() => {
    void reload();
    const timer = setInterval(() => void reload(), 60000);
    return () => clearInterval(timer);
  }, [reload]);
  async function act(id: string, action: string) {
    try {
      await api(`notifications/${id}`, "PATCH", { action });
      await reload();
    } catch (e) {
      notify(errorMessage(e), true);
    }
  }
  return (
    <>
      <button
        className="icon-button notification-button"
        aria-label={`Notifications, ${items.filter((n) => !n.readAt).length} unread`}
        onClick={() => {
          setOpen(true);
          void reload();
        }}
      >
        <Bell size={18} />
        {items.some((n) => !n.readAt) && <span className="nav-alert" />}
      </button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Notification center"
          description="Persistent reminders and incoming signals. Nothing is sent automatically."
        >
          <div className="form-body">
            <button
              className="button secondary"
              onClick={() => void act("all", "all-read")}
            >
              Mark all read
            </button>
            {!items.length && (
              <p className="muted">
                Gotham is suspiciously quiet. No new notifications.
              </p>
            )}
            {items.map((n) => (
              <div className={`notice ${n.readAt ? "" : "unread"}`} key={n.id}>
                <Link
                  href={n.href}
                  onClick={() => {
                    setOpen(false);
                    void act(n.id, "read");
                  }}
                >
                  {n.title}
                </Link>
                <small>{timeLabel(n.createdAt)}</small>
                <div className="button-row">
                  {!n.readAt && (
                    <button
                      className="button secondary"
                      onClick={() => void act(n.id, "read")}
                    >
                      Mark read
                    </button>
                  )}
                  <button
                    className="button secondary"
                    onClick={() => void act(n.id, "dismiss")}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
