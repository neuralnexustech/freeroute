import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Attempt DuckDuckGo instant answer / search API
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(ddgUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) freeroute/1.0" },
      signal: AbortSignal.timeout(4000),
    });

    const results: SearchResultItem[] = [];

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data) {
        if (data.AbstractText && data.AbstractURL) {
          results.push({
            title: data.Heading || q,
            url: data.AbstractURL,
            snippet: data.AbstractText,
            source: new URL(data.AbstractURL).hostname.replace("www.", ""),
          });
        }

        if (Array.isArray(data.RelatedTopics)) {
          for (const topic of data.RelatedTopics.slice(0, 5)) {
            if (topic.Text && topic.FirstURL) {
              const urlObj = new URL(topic.FirstURL);
              results.push({
                title: topic.Text.split(" - ")[0] || topic.Text.slice(0, 50),
                url: topic.FirstURL,
                snippet: topic.Text,
                source: urlObj.hostname.replace("www.", ""),
              });
            }
          }
        }
      }
    }

    // Fallback if no instant answers: fetch Wikipedia search for knowledge
    if (results.length === 0) {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=4&namespace=0&format=json`;
      const wikiRes = await fetch(wikiUrl, { signal: AbortSignal.timeout(3000) }).catch(() => null);
      if (wikiRes && wikiRes.ok) {
        const wikiData = await wikiRes.json().catch(() => null);
        if (Array.isArray(wikiData) && wikiData.length >= 4) {
          const titles = wikiData[1] || [];
          const snippets = wikiData[2] || [];
          const urls = wikiData[3] || [];
          for (let i = 0; i < titles.length; i++) {
            if (urls[i]) {
              results.push({
                title: titles[i],
                url: urls[i],
                snippet: snippets[i] || `Summary of ${titles[i]} on Wikipedia.`,
                source: "wikipedia.org",
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ query: q, results });
  } catch (err: any) {
    return NextResponse.json({ query: q, results: [] });
  }
}
