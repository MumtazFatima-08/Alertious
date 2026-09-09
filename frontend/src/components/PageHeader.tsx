import type { ReactNode } from "react";

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-border px-5 py-5 md:px-8 md:py-6">
      <div
        className="mb-4 h-[3px] w-16"
        style={{ background: "linear-gradient(90deg, #00E5FF, #8B5CF6 45%, #FF3D9A 75%, #FF8A00)" }}
        aria-hidden="true"
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow && <div className="text-xs font-semibold tracking-wide text-cyan">{eyebrow}</div>}
          <h1 className="mt-1 text-xl font-extrabold tracking-tight text-text">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
