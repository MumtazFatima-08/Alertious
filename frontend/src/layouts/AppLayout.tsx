import { NavLink, Outlet } from "react-router-dom";
import { LayoutGrid, ShieldAlert, ListTree, Search, SlidersHorizontal, PlayCircle, Settings, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import Logo from "../components/Logo";
import { api } from "../services/api";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/incidents", label: "Incidents", icon: ShieldAlert },
  { to: "/events", label: "Events", icon: ListTree },
  { to: "/investigate", label: "Investigate", icon: Search },
  { to: "/rules", label: "Rules", icon: SlidersHorizontal },
  { to: "/simulator", label: "Simulator", icon: PlayCircle },
];

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const check = () =>
      api
        .health()
        .then(() => mounted && setApiOnline(true))
        .catch(() => mounted && setApiOnline(false));
    check();
    const interval = setInterval(check, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg text-text">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-bg px-4 md:hidden">
        <div className="flex items-center gap-2">
          <Logo size={18} />
          <span className="text-base font-extrabold lowercase tracking-tight">alertious</span>
        </div>
        <button
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-sm p-1.5 text-muted hover:bg-surface"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed z-20 flex h-full w-56 shrink-0 flex-col border-r border-border bg-bg transition-transform md:static md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="hidden items-center gap-2.5 border-b border-border px-4 py-5 md:flex">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
            style={{ background: "radial-gradient(circle at 30% 30%, rgba(0,229,255,0.20), rgba(139,92,246,0.16) 45%, rgba(255,61,154,0.14) 75%, transparent 100%)" }}
          >
            <Logo size={22} />
          </div>
          <div>
            <div className="text-base font-extrabold lowercase leading-none tracking-tight text-text">alertious</div>
            <div className="mt-1 text-[10px] leading-none text-muted">from alerts to incidents.</div>
          </div>
        </div>

        <nav className="mt-12 flex-1 space-y-0.5 overflow-y-auto px-2 py-4 md:mt-0" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "border-l-2 border-cyan bg-cyan/[0.06] pl-[11px] font-medium text-cyan"
                    : "text-muted hover:bg-surface hover:text-text"
                }`
              }
            >
              <item.icon size={16} strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border px-2 py-3">
          <NavLink
            to="/settings"
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors ${
                isActive ? "bg-surface text-text" : "text-muted hover:bg-surface hover:text-text"
              }`
            }
          >
            <Settings size={16} strokeWidth={2} />
            Settings
          </NavLink>

          <div className="mt-3 flex items-center justify-between border border-border bg-surface px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium">
              <span
                className={`live-dot inline-block h-1.5 w-1.5 rounded-full ${apiOnline ? "bg-cyan" : "bg-crit"}`}
                style={{ boxShadow: apiOnline ? "0 0 6px #00E5FF99" : "0 0 6px #FF3D9A99" }}
                aria-hidden="true"
              />
              <span className={apiOnline ? "text-cyan" : "text-crit"}>{apiOnline === null ? "CONNECTING" : apiOnline ? "LIVE" : "OFFLINE"}</span>
            </div>
          </div>
          <div className="mt-2 px-1 text-[10px] leading-tight text-muted">
            Simulated environment — all data is synthetic
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <button
          aria-hidden="true"
          tabIndex={-1}
          className="fixed inset-0 z-10 bg-black/70 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main className="mt-12 h-[calc(100%-3rem)] flex-1 overflow-y-auto md:mt-0 md:h-full">
        <Outlet />
      </main>
    </div>
  );
}
