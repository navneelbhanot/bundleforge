/**
 * Global toast hook + host (M-182).
 *
 * Replaces the per-page `useState<string | null>` + local
 * `<Toast>` JSX pattern. Any component calls
 * `useToasts().show("Saved")` and the host (mounted once
 * inside an existing `<Frame>`) renders the Polaris Toast.
 *
 * Polaris only renders one Toast at a time per Frame;
 * `show()` replaces the current message. A snapshot-style
 * stacking queue would need its own renderer; deferred.
 */
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Toast } from "@shopify/polaris";

interface ToastsContextValue {
  show: (message: string, opts?: { error?: boolean }) => void;
  dismiss: () => void;
}

const ToastsContext = createContext<ToastsContextValue | null>(null);

export function useToasts(): ToastsContextValue {
  const ctx = useContext(ToastsContext);
  if (!ctx) {
    throw new Error(
      "useToasts() called outside <ToastsProvider>. Wrap the app shell.",
    );
  }
  return ctx;
}

interface ProviderProps {
  children: ReactNode;
}

interface ActiveToast {
  message: string;
  error: boolean;
  /** Monotonic key forces Polaris to remount the Toast when message changes. */
  key: number;
}

const ToastsRuntimeContext = createContext<ActiveToast | null>(null);

export function ToastsProvider({ children }: ProviderProps): JSX.Element {
  const [active, setActive] = useState<ActiveToast | null>(null);

  const value = useMemo<ToastsContextValue>(
    () => ({
      show: (message, opts) =>
        setActive({
          message,
          error: opts?.error === true,
          key: Date.now() + Math.random(),
        }),
      dismiss: () => setActive(null),
    }),
    [],
  );

  return (
    <ToastsContext.Provider value={value}>
      <ToastsRuntimeContext.Provider value={active}>
        {children}
      </ToastsRuntimeContext.Provider>
    </ToastsContext.Provider>
  );
}

/**
 * Mount once inside a Polaris `<Frame>`. Renders the active
 * toast (if any) and clears it on dismiss.
 */
export function ToastHost(): JSX.Element | null {
  const ctx = useContext(ToastsContext);
  const active = useContext(ToastsRuntimeContext);
  if (!ctx || !active) return null;
  return (
    <Toast
      key={active.key}
      content={active.message}
      error={active.error}
      onDismiss={ctx.dismiss}
    />
  );
}
