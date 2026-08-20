/**
 * dsh-script-library — host half (plain ESM JS, no build step).
 *
 * 1. Watches session tool activity: pairs tool/call with tool/result for
 *    run_code (PTC) executions and stages candidate entries into
 *    ~/.dsh/script-library/INDEX.staging.md.
 * 2. Injects a "check the library before writing scripts" rule into every
 *    session's system prompt (default behavior, not a reminder).
 * 3. Exposes a Remote namespace `scriptLibrary` for the sidebar UI:
 *    listStaged / countStaged / approveEntry / deleteEntry.
 *
 * The plugin class extends TypertRemoteService and provides ctx.scriptLibrary;
 * the same instance also runs the session observer, so ONE loader entry
 * carries both halves.
 */

import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import * as fs from "node:fs";
import * as path from "node:path";
import os from "node:os";

/** Library root. Honors DSH_HOME, falls back to ~/.dsh. */
export function libraryRoot() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
  return path.join(home, "script-library");
}

export function stagingIndexPath() {
  return path.join(libraryRoot(), "INDEX.staging.md");
}

export function formalIndexPath() {
  return path.join(libraryRoot(), "INDEX.md");
}

export function entriesDir() {
  return path.join(libraryRoot(), "entries");
}

const STAGING_MARKER = "<!-- 插件自动追加";

function ensureLibrary() {
  fs.mkdirSync(entriesDir(), { recursive: true });
}

/** Parse the staging index table into structured rows (best-effort). */
export function readStagingEntries() {
  const file = stagingIndexPath();
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8");
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 6) continue;
    const [id, type, name, summary, source, location] = cells;
    // Skip header row, empty placeholder, and separator rows (--- / —).
    if (!id || id === "ID" || id.startsWith("(空)")) continue;
    if (/^[-—]+$/.test(id) && /^[-—]+$/.test(type) && /^[-—]+$/.test(name)) continue;
    rows.push({ id, type, name, summary, source, location, createdAt: "" });
  }
  return rows;
}

/** Count of unconfirmed (staged) entries — what the UI badge shows. */
export function stagingCount() {
  return readStagingEntries().length;
}

/** Append one candidate row to the staging index. Idempotent by id. */
export function stageEntry(entry) {
  const file = stagingIndexPath();
  ensureLibrary();
  const existing = readStagingEntries();
  if (existing.some((e) => e.id === entry.id)) return false;
  const line = `| ${entry.id} | ${entry.type} | ${entry.name} | ${entry.summary} | ${entry.source} | ${entry.location} |`;
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const idx = text.indexOf(STAGING_MARKER);
  const insertion = idx >= 0 ? idx : text.length;
  const updated =
    text.slice(0, insertion) + line + "\n" + (idx >= 0 ? text.slice(insertion) : "");
  fs.writeFileSync(file, updated, "utf8");
  return true;
}

/** Remove one staged row by id. Returns true if it existed. */
export function removeStagedEntry(id) {
  const file = stagingIndexPath();
  if (!fs.existsSync(file)) return false;
  const text = fs.readFileSync(file, "utf8");
  const target = readStagingEntries().find((e) => e.id === id);
  if (!target) return false;
  const line = `| ${target.id} | ${target.type} | ${target.name} | ${target.summary} | ${target.source} | ${target.location} |`;
  const updated = text.replace(line, "");
  fs.writeFileSync(file, updated.replace(/\n{3,}/g, "\n\n"), "utf8");
  return true;
}

/** Deterministic kebab id from a script name. */
export function toKebab(idOrName) {
  return idOrName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Recursively extract and join every text block from a message content tree.
 * Real tool/result content is an array of block objects:
 *   content: [{ type: "tool-result", toolCallId, content: [{ type: "text", text }] }]
 * so plain `typeof content === "string"` checks miss it entirely.
 */
export function extractText(content) {
  if (typeof content === "string") return content;
  if (content == null) return "";
  const parts = [];
  const walk = (node) => {
    if (typeof node === "string") { parts.push(node); return; }
    if (Array.isArray(node)) { for (const v of node) walk(v); return; }
    if (node && typeof node === "object") {
      if (node.type === "text" && typeof node.text === "string") parts.push(node.text);
      for (const v of Object.values(node)) walk(v);
    }
  };
  walk(content);
  return parts.join("\n");
}

/**
 * Main plugin: remote gateway + session observer + system prompt rule.
 * One loader entry; the typert host descriptor (lib/typert.host.js) exposes
 * the Remote namespace to the browser.
 */
export class ScriptLibraryPlugin extends TypertRemoteService {
  static inject = ["sessions", "loader", "systemPrompt"];

  constructor(ctx, config = {}) {
    super(ctx, "scriptLibrary");
    this.pendingCalls = new Map();

    ctx.on("session/event", (session, event) => {
      this.onSessionEvent(session, event);
    });

    // System prompt rule: check the library before writing scripts.
    if (ctx.systemPrompt?.section) {
      ctx.systemPrompt.section({
        name: "script-library:policy",
        order: 48,
        text: () =>
          "When a task involves writing a script, automation, or a multi-step tool sequence (including PTC/run_code programs): FIRST read ~/.dsh/script-library/INDEX.md and INDEX.staging.md to look for a reusable script. Reuse or adapt before writing new code. After producing a reusable script, stage it (append a row to INDEX.staging.md per CONTRIBUTING.md) for later human review.",
      });
    }
  }

  // ── Remote methods (decorated below) ─────────────────────────────────────

  /** List all staged (unconfirmed) entries. */
  listStaged() {
    const entries = readStagingEntries();
    return { entries, count: entries.length };
  }

  /** Just the pending count for the badge. */
  countStaged() {
    return { count: stagingCount() };
  }

  /**
   * Approve one staged entry: promote its row to the formal INDEX.md and
   * remove it from staging. Returns the updated staging count.
   */
  approveEntry(id) {
    const rows = readStagingEntries();
    const target = rows.find((e) => e.id === id);
    if (!target) return { ok: false, error: `no staged entry ${id}`, count: rows.length };
    try {
      const formal = formalIndexPath();
      const formalText = fs.existsSync(formal) ? fs.readFileSync(formal, "utf8") : "";
      const formalLine = `| ${target.id} | ${target.type} | ${target.name} | ${target.summary} | 待补充 | ${target.location} |`;
      const anchor = "<!-- 新增条目时复制下面模板";
      const at = formalText.indexOf(anchor);
      const insertAt = at >= 0 ? at : formalText.length;
      const updatedFormal =
        formalText.slice(0, insertAt) + formalLine + "\n" + (at >= 0 ? formalText.slice(insertAt) : "");
      fs.writeFileSync(formal, updatedFormal, "utf8");
      removeStagedEntry(id);
      return { ok: true, count: stagingCount() };
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err), count: rows.length };
    }
  }

  /** Delete one staged entry (discard, no promotion). */
  deleteEntry(id) {
    const removed = removeStagedEntry(id);
    if (!removed) return { ok: false, error: `no staged entry ${id}`, count: stagingCount() };
    return { ok: true, count: stagingCount() };
  }

  // ── Session observation ──────────────────────────────────────────────────

  onSessionEvent(session, event) {
    try {
      if (!event || !event.type || !event.data) return;
      if (event.type === "tool/call") {
        this.onToolCall(session, event);
      } else if (event.type === "tool/result") {
        this.onToolResult(session, event);
      }
    } catch (err) {
      console.error("[script-library] observation error:", err);
    }
  }

  onToolCall(session, event) {
    const d = event.data;
    if (d.name !== "run_code") return;
    const key = `${session?.id ?? "?"}:${d.callId}`;
    let parsed;
    try {
      parsed = typeof d.arguments === "string" ? JSON.parse(d.arguments) : d.arguments;
    } catch {
      parsed = { description: String(d.arguments ?? "") };
    }
    this.pendingCalls.set(key, {
      name: d.name,
      args: parsed,
      description: parsed?.description ?? "",
      startedAt: event.time ?? Date.now(),
    });
    if (this.pendingCalls.size > 500) {
      const oldest = this.pendingCalls.keys().next().value;
      if (oldest) this.pendingCalls.delete(oldest);
    }
  }

  onToolResult(session, event) {
    const d = event.data;
    const message = d.message;
    if (!message || typeof message !== "object") return;
    // Real event shape (verified against session.jsonl):
    //   data: { turn, step, message: { source: { kind, callId }, content: [
    //     { type: "tool-result", toolCallId, content: [{ type: "text", text }] } ], role, id } }
    // The call id lives on message.source.callId, not on data.callId.
    const callId = d.callId ?? message.source?.callId;
    const key = `${session?.id ?? "?"}:${callId ?? ""}`;
    const call = this.pendingCalls.get(key);
    this.pendingCalls.delete(key);

    // name may not be present on the result message; recover it from the
    // paired call when available, else fall back to a generic probe.
    const name = message.name ?? call?.name;
    if (name !== "run_code" && name !== undefined) return;
    if (name === undefined && !call) return;

    if (message.isError) return;
    const content = extractText(message.content);
    if (content.length < 60) return; // trivial — not a candidate

    // Human-readable identity: prefer the run_code `description` argument
    // ("实际干了什么"), fall back to a kebab of the code/args.
    const description = (call?.description || "").trim();
    const label = description.slice(0, 60) || (call ? toKebab(JSON.stringify(call.args).slice(0, 80)) : "run");
    const base = toKebab(description.slice(0, 40));
    const id = `${base || "run"}-${Date.now().toString(36).slice(-4)}`;
    const entry = {
      id,
      type: "待定",
      name: label,
      summary: description || `${content.length >= 600 ? "多步" : "简短"} run_code 候选（输出约 ${content.length} 字符），待人工确认分类`,
      source: `run_code@${session?.id ?? "?"}`,
      location: `entries/${id}/`,
      createdAt: "",
    };
    const added = stageEntry(entry);
    if (added) {
      console.log(`[script-library] staged candidate ${id} (${content.length} chars)`);
    }
  }
}

// Apply the @Remote decorators. The decorators are standard stage-3 method
// decorators: they expect a decorator context object with { kind: 'method',
// name, static, private, addInitializer }. We emulate what the TS emit
// produces (the __esDecorate helper) for each Remote method.
function decorateMethod(target, name, decorator) {
  const initializers = [];
  const context = {
    kind: "method",
    name,
    static: false,
    private: false,
    access: {
      has: (obj) => name in obj,
      get: (obj) => obj[name],
    },
    metadata: undefined,
    addInitializer(fn) {
      initializers.push(fn);
    },
  };
  decorator(target.prototype[name], context);
  // The initializers run per-instance (this = an instance); markers are keyed
  // on the prototype. Construct a throwaway instance to seed the marker table
  // the same way the TS emit would at construction time — but avoid side
  // effects, so instead directly seed the prototype's marker table through
  // the addInitializer contract by invoking with a proxy whose prototype is
  // the class prototype.
  for (const init of initializers) {
    const instance = Object.create(target.prototype);
    init.call(instance);
  }
}

for (const method of ["listStaged", "countStaged", "approveEntry", "deleteEntry"]) {
  decorateMethod(ScriptLibraryPlugin, method, Remote(method));
}

export default ScriptLibraryPlugin;