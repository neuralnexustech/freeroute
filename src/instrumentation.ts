export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Run background auto-sync 3.5 seconds after server start
    setTimeout(async () => {
      try {
        const { syncAllProviders } = await import("@/lib/sync-engine");
        console.log("[Freeroute] 🚀 Startup auto-sync initiated for connected providers...");
        const res = await syncAllProviders({ testHealth: true, isStartup: true, maxTestPerProvider: 3 });
        console.log(
          `[Freeroute] ✅ Auto-sync completed: ${res.providersChecked} providers checked, ${res.totalModelsPulled} models pulled, ${res.modelsTested} models tested (${res.passed} healthy, ${res.failed} issues).`
        );
      } catch (err: any) {
        console.error("[Freeroute] Startup auto-sync error:", err?.message);
      }
    }, 3500);
  }
}
