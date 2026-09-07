import { NextRequest, NextResponse } from "next/server";
import { resolveModelSpecs, resolveViaOpenRouter, resolveViaWebSearch, resolveViaOfflineRegistry, resolveViaHeuristics } from "@/lib/model-info";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const testModel = body.testModel?.trim() || "gemini-2.5-flash";
  const providerSlug = body.providerSlug || "google";
  const option = String(body.option || "all");

  const runOne = async (optKey: string, name: string, fn: () => Promise<any> | any) => {
    const start = Date.now();
    try {
      const result = await fn();
      const latencyMs = Date.now() - start;
      return {
        option: optKey,
        name,
        ok: Boolean(result),
        latencyMs,
        result: result ?? {
          contextWindow: "–",
          inputPrice: 0,
          outputPrice: 0,
          modalities: "T",
          source: name,
        },
      };
    } catch (e: any) {
      return {
        option: optKey,
        name,
        ok: false,
        latencyMs: Date.now() - start,
        error: e?.message || "Lookup failed",
      };
    }
  };

  const tasks: Promise<any>[] = [];

  if (option === "1" || option === "all") {
    tasks.push(runOne("1", "Option 1: Live OpenRouter Public Catalog", () => resolveViaOpenRouter(testModel)));
  }
  if (option === "2" || option === "all") {
    tasks.push(runOne("2", "Option 2: DuckDuckGo Web Search Engine", () => resolveViaWebSearch(testModel, providerSlug)));
  }
  if (option === "3" || option === "all") {
    tasks.push(runOne("3", "Option 3: Built-In Offline Model Spec Database", () => resolveViaOfflineRegistry(testModel)));
  }
  if (option === "4" || option === "all") {
    tasks.push(runOne("4", "Option 4: Smart Heuristic & Family Parser", () => resolveViaHeuristics(testModel, providerSlug)));
  }

  const results = await Promise.all(tasks);
  return NextResponse.json({ testModel, providerSlug, results });
}
