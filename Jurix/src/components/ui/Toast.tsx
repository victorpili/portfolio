import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { CheckCircle, Warning, XCircle, Info } from "@phosphor-icons/react";
import { cn } from "../../lib/cn";

type ToastTone = "success" | "error" | "warning" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastApi {
  push: (toast: Omit<ToastItem, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback<ToastApi["push"]>((toast) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => remove(id), 5000);
  }, [remove]);

  const api: ToastApi = {
    push,
    success: (title, description) => push({ tone: "success", title, description }),
    error: (title, description) => push({ tone: "error", title, description }),
    warning: (title, description) => push({ tone: "warning", title, description }),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5 w-[360px]">
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const toneClasses: Record<ToastTone, string> = {
  success: "ring-[#cdddd0]",
  error: "ring-[#e7cbc8]",
  warning: "ring-[#e7d8b3]",
  info: "ring-[var(--color-hairline-strong)]",
};
const toneIconClasses: Record<ToastTone, string> = {
  success: "text-[var(--color-positive)]",
  error: "text-[var(--color-critical)]",
  warning: "text-[var(--color-warning)]",
  info: "text-[var(--color-accent)]",
};

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [enter, setEnter] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setEnter(true));
  }, []);

  const Icon = item.tone === "success" ? CheckCircle : item.tone === "error" ? XCircle : item.tone === "warning" ? Warning : Info;

  return (
    <div
      className={cn(
        "pointer-events-auto bg-[var(--color-surface)] rounded-[1rem] ring-1 ring-inset",
        "p-4 flex items-start gap-3 shadow-ambient",
        toneClasses[item.tone],
        "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
        enter ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      )}
      role="status"
    >
      <Icon weight="light" className={cn("w-5 h-5 mt-0.5 shrink-0", toneIconClasses[item.tone])} />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium text-[var(--color-ink)]">{item.title}</div>
        {item.description && (
          <div className="text-[12.5px] text-[var(--color-ink-muted)] mt-0.5 leading-relaxed">
            {item.description}
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)] transition-colors text-[18px] leading-none"
        aria-label="Fechar"
      >
        ×
      </button>
    </div>
  );
}
