"use client";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

export default function AccessPage() {
  const [identity, setIdentity] = useState("");
  const [keyCount, setKeyCount] = useState(0);
  const toast = useToast();

  useEffect(() => {
    fetch("/api/api-keys").then((r) => r.json()).then((d) => setKeyCount((d.keys ?? []).length)).catch(() => {});
  }, []);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Access Control &amp; Budgets</h1>
        <p className="page-sub">Configure member limits, RBAC identity mappings, and spend guardrails that prevent unexpected billing runaway.</p>
      </div>

      <div className="tab-group" style={{ marginBottom: 20 }}>
        <button className="active">Identities</button>
        <button onClick={() => toast.show("Aliases configured")}>Aliases</button>
        <button onClick={() => toast.show("Budgets & spend caps")}>Budgets</button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <span className="card-label">Member Daily Spend Limits</span>
          <span style={{ color: "var(--primary)", fontWeight: 600, fontSize: 12 }}>Workspace credits balance: $5.00</span>
        </div>
        <p style={{ color: "var(--text-tertiary)", fontSize: 12, marginBottom: 14 }}>
          Credits are pooled automatically across the organization. Caps govern individual bearer tokens.
        </p>
        <div className="table-wrapper" style={{ marginBottom: 0, border: "none" }}>
          <table>
            <thead><tr><th>Member Email</th><th>Active Keys</th><th>Daily Spend Cap</th><th>Spent Today</th><th className="num">Remaining Today</th></tr></thead>
            <tbody>
              <tr>
                <td>bidreshivaprasad@gmail.com</td>
                <td>{keyCount}</td>
                <td><span className="pill subtle">Tier Default</span></td>
                <td className="mono">$0.00</td>
                <td className="num mono">–</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-label" style={{ marginBottom: 12 }}>Configured Identities</div>
          <div style={{ background: "var(--bg-surface-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <b>Default Identity</b>
              <span className="pill active">DEFAULT</span>
            </div>
            <div style={{ color: "var(--text-tertiary)", fontSize: 12, marginTop: 4 }}>1 assigned member</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" className="input-field" placeholder="New identity name" value={identity} onChange={(e) => setIdentity(e.target.value)} style={{ flex: 1 }} />
            <button className="btn primary" onClick={() => { if (!identity.trim()) return toast.show("Enter an identity name"); toast.show(`Identity "${identity.trim()}" created`); setIdentity(""); }}>+ Add</button>
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <b>Default Identity Policy</b>
            <span className="pill subtle">org-0cde3617-080a-4dfc-b812-8fba0e2e1bef</span>
          </div>
          <p style={{ color: "var(--text-tertiary)", fontSize: 12, marginBottom: 16 }}>Assigned workspace members inherit full fallback routing policies.</p>
          <div className="card-label" style={{ marginBottom: 8 }}>Bound Members</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid var(--border-subtle)", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", padding: "10px 14px" }}>
            <span>bidreshivaprasad@gmail.com</span>
            <button className="btn sm" onClick={() => toast.show("Identity role permissions updated")}>Default (default) ▾</button>
          </div>
        </div>
      </div>
    </>
  );
}
