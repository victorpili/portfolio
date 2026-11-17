import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)]">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-[1320px] px-10 py-12">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
