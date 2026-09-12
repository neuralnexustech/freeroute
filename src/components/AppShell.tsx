"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreenApp = pathname?.startsWith("/playground") || pathname?.startsWith("/designer");

  if (isFullscreenApp) {
    return <div className="w-screen h-screen overflow-hidden bg-[#fafafa] dark:bg-[#0c0d12]">{children}</div>;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="page-container">{children}</main>
      </div>
    </div>
  );
}
