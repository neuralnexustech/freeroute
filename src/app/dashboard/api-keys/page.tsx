"use client";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revoked: boolean;
}

export default function ApiKeysPage() {
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [name, setName] = useState("");
  const [expire, setExpire] = useState("Never");
  const [newSecret, setNewSecret] = useState("");
  const [showRevoked, setShowRevoked] = useState(false);
  const [originUrl, setOriginUrl] = useState("");
  const toast = useToast();

  const load = () => fetch("/api/api-keys").then((r) => r.json()).then((d) => setRows(d.keys ?? [])).catch(() => {});
  useEffect(() => {
    load();
    if (typeof window !== "undefined") {
      setOriginUrl(window.location.origin);
    }
  }, []);

  const activeOrigin = originUrl || (typeof window !== "undefined" ? window.location.origin : "");

  const active = rows.filter((k) => !k.revoked);
  const shown = showRevoked ? rows : active;

  const create = async () => {
    if (!name.trim()) return toast.show("Please provide a descriptive key name");
    const map: Record<string, string> = { Never: "never", "30 days": "30d", "90 days": "90d", "1 year": "1y" };
    const res = await fetch("/api/api-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), expire: map[expire] ?? "never" }) });
    const d = await res.json();
    if (!res.ok) return toast.show(d.error ?? "Failed");
    setNewSecret(d.secret);
    setName("");
    toast.show(`API key "${name.trim()}" created`);
    load();
  };

  const revoke = async (id: string) => {
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    toast.show("Key revoked");
    load();
  };

  const copyFullKey = async (id: string, keyName: string) => {
    const res = await fetch(`/api/api-keys/${id}/reveal`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.secret) return toast.show(d.error ?? "Copy failed");
    await navigator.clipboard.writeText(d.secret);
    toast.show(`Full API key for "${keyName}" copied to clipboard`);
  };

  const rotate = async (id: string, keyName: string) => {
    const res = await fetch(`/api/api-keys/${id}/rotate`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast.show(d.error ?? "Rotation failed");
    setNewSecret(d.secret);
    toast.show(`Token for "${keyName}" rotated — copy the new secret now`);
    load();
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">API Keys</h1>
        <p className="page-sub">Bearer tokens authorize calls through the AI Gateway from code, SDKs, or local developer CLI terminals.</p>
      </div>

      {newSecret && (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--primary)" }}>
          <div className="card-label" style={{ marginBottom: 8 }}>New secret — copy now, it will not be shown again</div>
          <div className="codeblock-container">
            <code>{newSecret}</code>
            <button className="btn sm code-copy-btn" onClick={() => { navigator.clipboard.writeText(newSecret); toast.show("Copied to clipboard"); }}>Copy</button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="card-label" style={{ marginBottom: 6 }}>Key Identifier Name</div>
            <input type="text" className="input-field" placeholder="e.g. production-backend" value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
          </div>
          <div>
            <div className="card-label" style={{ marginBottom: 6 }}>Key Expiration</div>
            <select className="input-field" value={expire} onChange={(e) => setExpire(e.target.value)} style={{ cursor: "pointer" }}>
              <option>Never</option>
              <option>30 days</option>
              <option>90 days</option>
              <option>1 year</option>
            </select>
          </div>
          <button className="btn primary" onClick={create}>Create Key</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-label">{active.length} Active Key{active.length === 1 ? "" : "s"}</span>
          <button className="btn sm" onClick={() => setShowRevoked(!showRevoked)}>{showRevoked ? "Hide revoked" : "Show revoked"}</button>
        </div>
        <div className="table-wrapper" style={{ marginBottom: 0, border: "none" }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Key Secret</th>
                <th>Created</th>
                <th>Last Used</th>
                <th>Expires</th>
                <th>Status</th>
                <th className="num">Spend (30d)</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((k) => (
                <tr key={k.id}>
                  <td><b>{k.name}</b></td>
                  <td className="mono" style={{ color: "var(--primary)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {k.prefix}…
                      <button
                        className="btn sm"
                        style={{ padding: "2px 7px", lineHeight: 1.4 }}
                        title="Copy full API key"
                        aria-label={`Copy full key ${k.name}`}
                        onClick={() => copyFullKey(k.id, k.name)}
                      >
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                      </button>
                    </span>
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>{new Date(k.createdAt).toLocaleString()}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}</td>
                  <td><span className="pill subtle">{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : "Never"}</span></td>
                  <td><span className={`pill ${k.revoked ? "danger" : "active"}`}>{k.revoked ? "Revoked" : "Active"}</span></td>
                  <td className="num mono">$0.00</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn sm" onClick={() => toast.show(`Editing limits for key: ${k.name}`)}>Limits</button>{" "}
                    {!k.revoked && (<><button className="btn sm" onClick={() => rotate(k.id, k.name)}>Rotate</button>{" "}<button className="btn sm danger" onClick={() => revoke(k.id)}>Revoke</button></>)}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={8}><div className="empty-state-box">No keys yet.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-label" style={{ marginBottom: 12 }}>Gateway Endpoint Integration — OpenAI compatible</div>
        <div style={{ marginBottom: 14 }}>
          <div className="card-label" style={{ marginBottom: 4 }}>Base URL</div>
          <div className="codeblock-container">
            <code>{`${activeOrigin}/v1`}</code>
            <button className="btn sm code-copy-btn" onClick={() => { navigator.clipboard.writeText(`${activeOrigin}/v1`); toast.show("Copied to clipboard"); }}>Copy</button>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div className="card-label" style={{ marginBottom: 4 }}>List models</div>
          <div className="codeblock-container">
            <code>{`curl ${activeOrigin}/v1/models -H "Authorization: Bearer $FREEROUTE_API_KEY"`}</code>
            <button className="btn sm code-copy-btn" onClick={() => { navigator.clipboard.writeText(`curl ${activeOrigin}/v1/models -H "Authorization: Bearer $FREEROUTE_API_KEY"`); toast.show("Copied to clipboard"); }}>Copy</button>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div className="card-label" style={{ marginBottom: 4 }}>Chat completion</div>
          <div className="codeblock-container">
            <code>{`curl ${activeOrigin}/v1/chat/completions -H "Content-Type: application/json" -H "Authorization: Bearer $FREEROUTE_API_KEY" -d '{"model": "deepseek-ai/deepseek-v4-flash-0731", "messages": [{"role": "user", "content": "Hello"}]}'`}</code>
            <button className="btn sm code-copy-btn" onClick={() => { navigator.clipboard.writeText(`curl ${activeOrigin}/v1/chat/completions -H "Content-Type: application/json" -H "Authorization: Bearer $FREEROUTE_API_KEY" -d '{"model": "deepseek-ai/deepseek-v4-flash-0731", "messages": [{"role": "user", "content": "Hello"}]}'`); toast.show("Copied to clipboard"); }}>Copy</button>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div className="card-label" style={{ marginBottom: 4 }}>Python (openai SDK)</div>
          <div className="codeblock-container">
            <code>{`client = OpenAI(base_url="${activeOrigin}/v1", api_key=os.environ["FREEROUTE_API_KEY"])`}</code>
            <button className="btn sm code-copy-btn" onClick={() => { navigator.clipboard.writeText(`client = OpenAI(base_url="${activeOrigin}/v1", api_key=os.environ["FREEROUTE_API_KEY"])`); toast.show("Copied to clipboard"); }}>Copy</button>
          </div>
        </div>
        <div>
          <div className="card-label" style={{ marginBottom: 4 }}>Node.js (openai SDK)</div>
          <div className="codeblock-container">
            <code>{`new OpenAI({ baseURL: "${activeOrigin}/v1", apiKey: process.env.FREEROUTE_API_KEY })`}</code>
            <button className="btn sm code-copy-btn" onClick={() => { navigator.clipboard.writeText(`new OpenAI({ baseURL: "${activeOrigin}/v1", apiKey: process.env.FREEROUTE_API_KEY })`); toast.show("Copied to clipboard"); }}>Copy</button>
          </div>
        </div>
      </div>
    </>
  );
}
