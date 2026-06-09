"use client";

import { Download, HardDrive, Router, Wifi } from "lucide-react";
import { useState } from "react";

import { Button } from "../ui";

export function SettingsClient() {
  const [status, setStatus] = useState<string | null>(null);

  async function createBackup() {
    setStatus(null);
    const response = await fetch("/api/settings/backup", { method: "POST" });
    const payload = (await response.json()) as { backupPath?: string; error?: string };

    if (!response.ok || !payload.backupPath) {
      setStatus(payload.error ?? "Backup could not be created.");
      return;
    }

    setStatus(`Backup created at ${payload.backupPath}`);
  }

  return (
    <div className="screen-stack">
      <section className="panel settings-panel">
        <div className="icon-title">
          <HardDrive aria-hidden="true" size={24} />
          <div>
            <h2>Local data</h2>
            <p>Recipes, plans, AI runs, and lists stay on this machine.</p>
          </div>
        </div>
        <div className="settings-action-grid">
          <a className="button button-secondary" href="/api/settings/export">
            <Download aria-hidden="true" size={18} />
            Export JSON
          </a>
          <Button onClick={createBackup} type="button">
            <HardDrive aria-hidden="true" size={18} />
            Backup SQLite
          </Button>
        </div>
        {status ? <p className="status-text">{status}</p> : null}
      </section>

      <section className="panel settings-panel">
        <div className="icon-title">
          <Router aria-hidden="true" size={24} />
          <div>
            <h2>Use on home Wi-Fi</h2>
            <p>Run the dev server on this Mac and open the network URL from a phone on the same Wi-Fi.</p>
          </div>
        </div>
        <dl className="settings-list">
          <div>
            <dt>Mac command</dt>
            <dd>npm run dev -- --hostname 0.0.0.0</dd>
          </div>
          <div>
            <dt>Phone URL</dt>
            <dd>http://your-mac-ip:3000</dd>
          </div>
          <div>
            <dt>Privacy</dt>
            <dd>Use only on trusted home networks</dd>
          </div>
        </dl>
      </section>

      <section className="panel settings-panel">
        <div className="icon-title">
          <Wifi aria-hidden="true" size={24} />
          <div>
            <h2>Offline behavior</h2>
            <p>Saved recipes, plans, shopping lists, and cooking views continue to read from local SQLite.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
