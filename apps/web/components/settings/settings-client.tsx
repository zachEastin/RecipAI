"use client";

import { Download, HardDrive, Router } from "lucide-react";
import { useState } from "react";

import { Button } from "../ui";

export function SettingsClient() {
  const [status, setStatus] = useState<string | null>(null);

  async function createBackup() {
    setStatus(null);
    const response = await fetch("/api/settings/backup", { method: "POST" });
    const payload = (await response.json()) as {
      backupPath?: string;
      error?: string;
    };

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
            <h2>Phone access</h2>
          </div>
        </div>
        <dl className="settings-list">
          <div>
            <dt>Run</dt>
            <dd>npm run dev -- --hostname 0.0.0.0</dd>
          </div>
          <div>
            <dt>Open</dt>
            <dd>http://your-mac-ip:3000</dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>Trusted Wi-Fi only</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
