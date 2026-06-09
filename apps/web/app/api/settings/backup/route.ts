import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { NextResponse } from "next/server";

import { databasePathFromUrl } from "@recipai/db";

import { loadLocalEnv } from "@/lib/local-env";

export async function POST() {
  loadLocalEnv();

  const source = databasePathFromUrl();
  const backupPath = join(
    dirname(source),
    "backups",
    `recipai-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
  );

  mkdirSync(dirname(backupPath), { recursive: true });
  copyFileSync(source, backupPath);

  return NextResponse.json({ backupPath });
}
