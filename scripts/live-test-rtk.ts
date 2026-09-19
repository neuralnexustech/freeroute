import { compressToolResults } from "../src/lib/rtk/compressToolResults";

async function runLiveTest() {
  console.log("=== 1. TESTING RTK DIRECT COMPRESSION ===");
  const verboseToolResult = `
diff --git a/src/index.ts b/src/index.ts
index 83a2184..9f3810c 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,15 +1,15 @@
-import oldLib from 'old-lib';
+import newLib from 'new-lib';
 unchanged context line 1
 unchanged context line 2
 unchanged context line 3
 unchanged context line 4
 unchanged context line 5
 unchanged context line 6
 unchanged context line 7
 unchanged context line 8
 unchanged context line 9
 unchanged context line 10
-const a = 1;
+const a = 2;
 unchanged line 11
 unchanged line 12
 unchanged line 13
 unchanged line 14
 unchanged line 15
`;

  const mockMessages = [
    { role: "user", content: "Check the status" },
    {
      role: "tool",
      tool_call_id: "call_123",
      content: verboseToolResult,
    },
  ];

  const compressed = compressToolResults(mockMessages);
  console.log("Original message chars:", JSON.stringify(mockMessages).length);
  console.log("Compressed message chars:", JSON.stringify(compressed.messages).length);
  console.log("Tokens saved calculated:", compressed.tokensSaved);
  console.log("Compressed blocks count:", compressed.compressedCount);
  console.log("Compressed tool content:\n", compressed.messages[1].content);

  console.log("\n=== 2. TESTING LIVE GATEWAY HTTP REQUEST ===");
  try {
    const res = await fetch("http://localhost:20129/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer freeroute-designer",
      },
      body: JSON.stringify({
        model: "meta/llama-3.2-11b-vision-instruct",
        messages: mockMessages,
        stream: false,
      }),
    });

    console.log("Response Status:", res.status, res.statusText);
    console.log("Header x-rtk-tokens-saved:", res.headers.get("x-rtk-tokens-saved"));
    console.log("Header x-rtk-compressed:", res.headers.get("x-rtk-compressed"));
    console.log("Header x-provider:", res.headers.get("x-provider"));
    console.log("Header x-model-slug:", res.headers.get("x-model-slug"));

    const data = await res.json().catch(() => null);
    console.log("Response body preview:", JSON.stringify(data)?.slice(0, 200));

    console.log("\n=== 3. VERIFYING LIVE /api/overview TELEMETRY ===");
    const overviewRes = await fetch("http://localhost:20129/api/overview");
    const overview = await overviewRes.json();
    console.log("Overview spend:", overview.spend);
    console.log("Overview total tokens:", overview.tokens);
    console.log("Overview rtkTokensSaved:", overview.rtkTokensSaved);
  } catch (err: any) {
    console.error("HTTP request error:", err?.message || err);
  }
}

runLiveTest();
