import { NextRequest, NextResponse } from "next/server";
import {
  resolveModelSpecs,
  resolveViaOpenRouter,
  resolveViaWebSearch,
  resolveViaOfflineRegistry,
  resolveViaHeuristics,
} from "@/lib/model-info";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const testModel = body.testModel?.trim() || "google/gemini-2.5-flash";
    const providerSlug = body.providerSlug || "";
    const requestedOption = String(body.option || "all");

    const strategySetting = await prisma.setting
      .findUnique({
        where: { key: "pull_info_strategy" },
      })
      .catch(() => null);
    const currentStrategy = body.strategy || strategySetting?.value || "cascade";

    const runOne = async (optKey: string, name: string, badge: string, fn: () => Promise<any> | any) => {
      const start = Date.now();
      try {
        const result = await fn();
        const latencyMs = Date.now() - start;
        const isOk = Boolean(result && result.contextWindow && result.contextWindow !== "–");
        return {
          option: optKey,
          name,
          badge,
          ok: isOk,
          latencyMs,
          result: result ?? {
            contextWindow: "–",
            inputPrice: 0,
            outputPrice: 0,
            modalities: "T",
            params: "–",
            score: 0,
            source: name,
            detail: "Model not found in this catalog",
          },
        };
      } catch (e: any) {
        return {
          option: optKey,
          name,
          badge,
          ok: false,
          latencyMs: Date.now() - start,
          error: e?.message || "Lookup failed",
        };
      }
    };

    const tasks: Promise<any>[] = [];

    // All 4 Discovery Options
    tasks.push(runOne("1", "Option 1: Live OpenRouter Public Catalog", "Zero-Key · Web API", () => resolveViaOpenRouter(testModel)));
    tasks.push(runOne("2", "Option 2: DuckDuckGo Web Search Engine", "Live Web Scrape", () => resolveViaWebSearch(testModel, providerSlug)));
    tasks.push(runOne("3", "Option 3: Built-In Offline Model Spec Database", "0ms · Offline", () => resolveViaOfflineRegistry(testModel)));
    tasks.push(runOne("4", "Option 4: Smart Heuristic & Family Parser", "Rule-based Fallback", () => resolveViaHeuristics(testModel, providerSlug)));

    const allResults = await Promise.all(tasks);
    const sortedResults = allResults.sort((a, b) => parseInt(a.option, 10) - parseInt(b.option, 10));

    // Compute Cascade Resolution Decision under active strategy
    const cascadeStart = Date.now();
    const decisionResult = await resolveModelSpecs(testModel, providerSlug, currentStrategy);
    const cascadeLatencyMs = Date.now() - cascadeStart;

    let winnerOption = "4";
    if (decisionResult.source.includes("Offline")) winnerOption = "3";
    else if (decisionResult.source.includes("OpenRouter") || decisionResult.source.includes("Catalog")) winnerOption = "1";
    else if (decisionResult.source.includes("Search") || decisionResult.source.includes("DuckDuckGo")) winnerOption = "2";
    else if (decisionResult.source.includes("Heuristic")) winnerOption = "4";

    const filteredResults = requestedOption === "all"
      ? sortedResults
      : sortedResults.filter((r) => r.option === requestedOption);

    return NextResponse.json({
      testModel,
      providerSlug,
      strategy: currentStrategy,
      decision: {
        winnerOption,
        winnerName: sortedResults.find((r) => r.option === winnerOption)?.name || decisionResult.source,
        latencyMs: cascadeLatencyMs,
        result: decisionResult,
      },
      results: filteredResults,
    });
  } catch (error: any) {
    console.error("test-info-resolver error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error", results: [] },
      { status: 500 }
    );
  }
}
