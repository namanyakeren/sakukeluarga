"use client";

import { useCallback, useEffect, useState } from "react";
import { APP_TZ, formatDateTimeID } from "@saku/shared";
import { IconRefresh, IconSearch, IconTerminal } from "./icons";
import { cn } from "./ui";

interface LogEntry {
  id: string;
  time: number;
  level: number;
  levelName: string;
  source: "web" | "wa";
  msg: string;
  details?: string;
}

interface LogFileInfo {
  source: "web" | "wa";
  file: string;
  size: number;
  updatedAt: number | null;
}

interface LogResponse {
  entries: LogEntry[];
  files: LogFileInfo[];
  generatedAt: number;
  error?: string;
}

const LEVEL_STYLES: Record<string, string> = {
  trace: "bg-slate-100 text-slate-500",
  debug: "bg-slate-100 text-slate-600",
  info: "bg-sky-50 text-sky-700",
  warn: "bg-amber-50 text-amber-700",
  error: "bg-rose-50 text-rose-700",
  fatal: "bg-rose-600 text-white",
};

const SOURCE_STYLES: Record<string, string> = {
  web: "bg-indigo-50 text-indigo-700",
  wa: "bg-emerald-50 text-emerald-700",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTime(time: number): string {
  if (!time) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: APP_TZ,
  }).format(new Date(time));
}

export function LogViewer() {
  const [source, setSource] = useState("all");
  const [level, setLevel] = useState("all");
  const [query, setQuery] = useState("");
  const [auto, setAuto] = useState(true);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [files, setFiles] = useState<LogFileInfo[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ source, level, limit: "300" });
    if (query.trim()) params.set("q", query.trim());

    try {
      const response = await fetch(`/api/admin/logs?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as LogResponse;
      if (!response.ok) throw new Error(data.error || "Gagal membaca log.");

      setEntries(data.entries);
      setFiles(data.files);
      setUpdatedAt(data.generatedAt);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal membaca log.");
    } finally {
      setLoading(false);
    }
  }, [source, level, query]);

  // Debounce pencarian supaya tidak membanjiri server saat mengetik.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [auto, load]);

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="log-source">
              Sumber
            </label>
            <select
              id="log-source"
              className="input"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="all">Web + WhatsApp</option>
              <option value="web">Web</option>
              <option value="wa">WhatsApp</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="log-level">
              Level
            </label>
            <select
              id="log-level"
              className="input"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            >
              <option value="all">Semua level</option>
              <option value="error">Error &amp; fatal</option>
              <option value="warn">Peringatan ke atas</option>
              <option value="info">Info ke atas</option>
              <option value="debug">Debug ke atas</option>
              <option value="trace">Semua (trace)</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="log-search">
              Cari pesan
            </label>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="log-search"
                className="input pl-9"
                placeholder="mis. error, gagal, transfer, nomor"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
          <label className="inline-flex items-center gap-2 font-medium text-slate-600">
            <input
              type="checkbox"
              checked={auto}
              onChange={(event) => setAuto(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
            />
            Muat ulang otomatis tiap 5 detik
          </label>

          <span>
            {loading && entries.length === 0
              ? "Memuat log..."
              : `${entries.length} baris ditampilkan`}
          </span>

          {updatedAt ? <span>· diperbarui {formatDateTimeID(new Date(updatedAt))}</span> : null}

          <button
            type="button"
            onClick={() => void load()}
            className="ml-auto inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline"
          >
            <IconRefresh className="h-3.5 w-3.5" /> Muat ulang
          </button>
        </div>

        <p className="mt-2 text-[11px] text-slate-400">
          {files.length > 0
            ? `File log: ${files.map((file) => file.file).join(", ")} (${formatBytes(totalSize)}). Menampilkan 1 MB terakhir per file.`
            : "File log belum tersedia. Log baru muncul setelah container web/WA menulis ke volume /logs."}
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="card overflow-hidden">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <IconTerminal className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-slate-700">Belum ada log yang cocok</p>
            <p className="max-w-sm text-xs text-slate-500">
              Coba ubah filter atau tunggu aktivitas berikutnya. Log error dan notifikasi
              akan muncul di sini secara otomatis.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 font-mono text-[11px]">
            {entries.map((entry) => {
              const open = expanded === entry.id;
              const hasMore = Boolean(entry.details) || entry.msg.length > 160;

              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : entry.id)}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-slate-50",
                      !hasMore && "cursor-default",
                    )}
                  >
                    <span className="w-16 shrink-0 tabular-nums text-slate-400">
                      {formatTime(entry.time)}
                    </span>
                    <span
                      className={cn(
                        "w-[3.6rem] shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-semibold uppercase",
                        LEVEL_STYLES[entry.levelName] ?? LEVEL_STYLES.info,
                      )}
                    >
                      {entry.levelName}
                    </span>
                    <span
                      className={cn(
                        "w-10 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-semibold uppercase",
                        SOURCE_STYLES[entry.source],
                      )}
                    >
                      {entry.source}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 whitespace-pre-wrap break-words text-slate-700",
                        !open && "max-h-12 overflow-hidden",
                      )}
                    >
                      {entry.msg}
                      {open && entry.details ? (
                        <span className="mt-2 block rounded-lg bg-slate-900 px-3 py-2 text-[10px] leading-relaxed text-slate-100">
                          {entry.details}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
