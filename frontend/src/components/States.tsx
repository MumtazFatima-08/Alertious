import type { ReactNode } from "react";
import { Loader2, Inbox, AlertTriangle } from "lucide-react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="text-muted">{icon ?? <Inbox size={22} />}</div>
      <div className="text-sm font-medium text-text">{title}</div>
      {description && <div className="max-w-sm text-xs text-muted">{description}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <AlertTriangle size={20} style={{ color: "#FF3D9A" }} />
      <div className="text-sm font-medium text-text">Something went wrong</div>
      <div className="max-w-sm text-xs text-muted">{message}</div>
    </div>
  );
}
