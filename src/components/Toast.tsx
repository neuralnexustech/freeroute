"use client";
import { create } from "zustand";

interface ToastState {
  msg: string;
  visible: boolean;
  show: (msg: string) => void;
}

export const useToast = create<ToastState>((set) => ({
  msg: "",
  visible: false,
  show: (msg) => {
    set({ msg, visible: true });
    setTimeout(() => set({ visible: false }), 2800);
  },
}));

export function Toast() {
  const { msg, visible } = useToast();
  return (
    <div className={`toast ${visible ? "show" : ""}`} role="status">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span>{msg || "Done"}</span>
    </div>
  );
}
