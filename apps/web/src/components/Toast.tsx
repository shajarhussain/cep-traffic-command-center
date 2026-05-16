import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "./Icon.js";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error:   (message: string) => void;
  info:    (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICON: Record<ToastKind, string> = { success: "check", error: "alert-triangle", info: "bolt" };
const LABEL: Record<ToastKind, string> = { success: "Success", error: "Error", info: "Info" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = idRef.current++;
    setToasts(prev => {
      const next = [...prev, { id, kind, message }];
      return next.length > 4 ? next.slice(next.length - 4) : next;
    });
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const api: ToastApi = {
    success: useCallback((m) => push("success", m), [push]),
    error:   useCallback((m) => push("error",   m), [push]),
    info:    useCallback((m) => push("info",    m), [push]),
  };

  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span className="toast-icon" aria-hidden="true"><Icon name={ICON[t.kind]} size={12} /></span>
            <div className="toast-body">
              <div className="fw-600" style={{ fontSize: 12, marginBottom: 2 }}>{LABEL[t.kind]}</div>
              <div className="text-sec" style={{ fontSize: 12, color: "var(--text-sec)" }}>{t.message}</div>
            </div>
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification"><Icon name="close" size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe fallback for components rendered outside the provider — avoid crashing.
    return {
      success: (m) => console.info("[toast:success]", m),
      error:   (m) => console.warn("[toast:error]",   m),
      info:    (m) => console.info("[toast:info]",    m),
    };
  }
  return ctx;
}
