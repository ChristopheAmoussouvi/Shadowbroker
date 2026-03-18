export type ToastType = "info" | "success" | "warning" | "error" | "alert";

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    body?: string;
    /** Duration in ms. 0 = persistent. Default 4000. */
    duration?: number;
    timestamp: number;
}

type ToastListener = (toasts: Toast[]) => void;

// Module-level store — accessible outside React tree
let toasts: Toast[] = [];
const listeners = new Set<ToastListener>();
const MAX_VISIBLE = 5;
let _counter = 0;

function notify() {
    listeners.forEach((fn) => fn([...toasts]));
}

/** Subscribe to toast changes. Returns an unsubscribe function. */
export function subscribeToasts(listener: ToastListener): () => void {
    listeners.add(listener);
    listener([...toasts]);
    return () => listeners.delete(listener);
}

/** Push a new toast. Returns the generated id. */
export function pushToast(toast: Omit<Toast, "id" | "timestamp">): string {
    const id = `toast-${++_counter}`;
    const entry: Toast = { ...toast, id, timestamp: Date.now() };
    toasts = [entry, ...toasts].slice(0, MAX_VISIBLE);
    notify();
    return id;
}

/** Dismiss a single toast by id. */
export function dismissToast(id: string): void {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
}

/** Dismiss all toasts. */
export function dismissAllToasts(): void {
    toasts = [];
    notify();
}
