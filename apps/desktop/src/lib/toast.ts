import { createSignal } from "solid-js";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

const [toasts, setToasts] = createSignal<ToastItem[]>([]);

export const showToast = (message: string, type: ToastType = "info", duration = 3500) => {
  const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const item: ToastItem = { id, type, message, duration };

  setToasts((prev) => [...prev, item]);

  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }

  return id;
};

export const dismissToast = (id: string) => {
  setToasts((prev) => prev.filter((t) => t.id !== id));
};

export const toast = {
  success: (message: string, duration?: number) => showToast(message, "success", duration),
  error: (message: string, duration?: number) => showToast(message, "error", duration),
  info: (message: string, duration?: number) => showToast(message, "info", duration),
  warning: (message: string, duration?: number) => showToast(message, "warning", duration),
  dismiss: dismissToast,
};

export { toasts };
