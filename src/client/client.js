/* dsh-script-library — client (browser) half, built as the lazy-CJS bundle
 * shape the web module loader consumes:
 *
 *   window.__ModuleLoader__.load({ id, factory })  where factory(require)
 *   exports { apply, inject }.
 *
 * Hand-written (no build step): the web shell's module loader materializes
 * this file through its standard graph row (window.__DSH_BOOT__) once the
 * package is a web dsh.client loader entry.
 */
window.__ModuleLoader__.load({
  id: "dsh-script-library",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    let react;
    try {
      react = require("react");
    } catch (err) {
      if (typeof window !== "undefined") window.__DSH_SL_LOAD_ERROR__ = String(err && err.message || err);
      throw err;
    }
    let React = react;

    /** Dictionary namespace owned by this plugin. */
    const NS = "scriptLibrary";

    /** Required services for the sidebar action, overlay panel, and RPC calls.
     *  Remote calls go through the direct `rpc()` helper (same wire format as
     *  the connection carrier) rather than `ctx.remote`, because a namespace
     *  self-mounted via $mount cannot be declared in inject (deadlock) and
     *  accessing it without inject trips the Cordis guard. */
    const inject = ["slots", "locale"];



    /** Simple badge + label entry rendered at the sidebar foot. */
    function SidebarAction(props) {
      let { wide, count, onOpen, subscribe, getSnapshot } = props || {};
      const label = "📚 脚本库";
      if (typeof React !== "undefined" && typeof React.useSyncExternalStore === "function" && typeof subscribe === "function" && typeof getSnapshot === "function") {
        const live = React.useSyncExternalStore(subscribe, getSnapshot);
        // count from the live store when it is available
        count = live.count;
      }
      try {
      return React.createElement(
        "button",
        {
          className: "sl-action",
          onClick: onOpen,
          title: label,
          style: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "8px 12px",
            margin: "4px 8px",
            border: "1px solid rgba(229, 72, 77, 0.6)",
            background: "rgba(229, 72, 77, 0.12)",
            color: "var(--dsw-alias-label-primary, #e5484d)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
          },
        },
        React.createElement(
          "span",
          {
            style: { flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
          },
          wide ? label : "📂"
        ),
        React.createElement(
          "span",
          {
            className: "sl-count",
            style: {
              background: (count || 0) > 0 ? "var(--dsw-alias-state-error-primary, #e5484d)" : "transparent",
              color: "#fff",
              borderRadius: 999,
              fontSize: 11,
              minWidth: 18,
              height: 18,
              display: (count || 0) > 0 ? "inline-flex" : "none",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 5px",
            },
          },
          String(count || 0)
        )
      );
      } catch (err) {
        return React.createElement("div", { className: "sl-action" }, "脚本库");
      }
    }

    /** Latest staged-entry snapshot for DOM panel re-renders (module scope so
     *  the plain-DOM handlers can rebuild the panel after approve/delete). */
    let latestEntries = [];

    /** Overlay panel rendered with plain DOM (immune to slots-render
     *  staleness): a fixed backdrop with the staged-entry list, approve and
     *  delete buttons, and a close affordance.
     *  @param entries - staged entries to list.
     *  @param refreshFn - caller-provided refresh() (apply closure), invoked
     *    after approve/delete so the panel and badge re-sync. */
    function renderPanelDom(entries, refreshFn) {
      try {
        if (typeof document === "undefined") return;
        const old = document.getElementById("dsh-sl-panel");
        if (old) old.remove();
        const backdrop = document.createElement("div");
        backdrop.id = "dsh-sl-panel";
        backdrop.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:20000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";
        const card = document.createElement("div");
        card.style.cssText = "background:var(--dsw-alias-surface-strong,#fff);color:var(--dsw-alias-label-primary,#222);border-radius:12px;box-shadow:0 12px 48px rgba(0,0,0,.4);width:min(560px,92vw);max-height:70vh;display:flex;flex-direction:column;overflow:hidden;";
        const head = document.createElement("div");
        head.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(0,0,0,.1);font-weight:700;font-size:15px;";
        head.textContent = "📚 脚本库 · 待确认" + (entries.length ? "（" + entries.length + "）" : "");
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "✕";
        closeBtn.style.cssText = "border:none;background:transparent;font-size:16px;cursor:pointer;color:inherit;padding:4px 8px;border-radius:6px;";
        closeBtn.onclick = () => { backdrop.remove(); };
        head.appendChild(closeBtn);
        const body = document.createElement("div");
        body.style.cssText = "flex:1;overflow-y:auto;padding:10px 18px;";
        if (!entries.length) {
          body.textContent = "🎉 暂无待确认条目";
          body.style.cssText += ";color:#888;padding:24px 18px;text-align:center;";
        } else {
          for (const e of entries) {
            const row = document.createElement("div");
            row.style.cssText = "display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.06);";
            const info = document.createElement("div");
            info.style.cssText = "flex:1;min-width:0;";
            const name = document.createElement("div");
            name.style.cssText = "font-weight:600;font-size:13px;line-height:1.5;word-break:break-all;white-space:normal;";
            name.textContent = "[" + (e.type || "待定") + "] " + (e.name || e.id || "");
            name.title = e.summary || "";
            const sum = document.createElement("div");
            sum.style.cssText = "font-size:12px;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
            sum.textContent = [e.summary, e.source].filter(Boolean).join(" · ");
            info.appendChild(name);
            info.appendChild(sum);
            const appr = document.createElement("button");
            appr.textContent = "确认入库";
            appr.style.cssText = "border:none;background:#e5484d;color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;";
            appr.onclick = async () => {
              appr.disabled = true;
              try { await rpc("scriptLibrary", "approveEntry", { id: e.id }); } catch (err) { console.error(err); }
              if (typeof refreshFn === "function") await refreshFn();
              renderPanelDom(latestEntries, refreshFn);
            };
            const del = document.createElement("button");
            del.textContent = "删除";
            del.style.cssText = "border:1px solid rgba(0,0,0,.2);background:transparent;color:inherit;padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;";
            del.onclick = async () => {
              del.disabled = true;
              try { await rpc("scriptLibrary", "deleteEntry", { id: e.id }); } catch (err) { console.error(err); }
              if (typeof refreshFn === "function") await refreshFn();
              renderPanelDom(latestEntries, refreshFn);
            };
            row.appendChild(info);
            row.appendChild(appr);
            row.appendChild(del);
            body.appendChild(row);
          }
        }
        card.appendChild(head);
        card.appendChild(body);
        backdrop.appendChild(card);
        backdrop.onclick = (ev) => { if (ev.target === backdrop) backdrop.remove(); };
        document.body.appendChild(backdrop);
        if (typeof refreshFn === "function") refreshFn();
      } catch (err) {
        console.error("[script-library] renderPanelDom failed:", err);
      }
    }

    /** Fake render of the panel component — superseded by renderPanelDom. */
    function Panel(props) {
      const { entries, count, onApprove, onDelete, onClose, t } = props;
      return React.createElement(
        "div",
        {
          style: {
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            pointerEvents: "auto",
          },
          onClick: onClose,
        },
        React.createElement(
          "div",
          {
            style: {
              background: "var(--dsw-alias-bg-base, #fff)",
              borderRadius: 12,
              width: 560,
              maxWidth: "90vw",
              maxHeight: "70vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 8px 40px rgba(0,0,0,.2)",
              overflow: "hidden",
            },
            onClick: (e) => e.stopPropagation(),
          },
          // Header
          React.createElement(
            "div",
            {
              style: {
                padding: "12px 16px",
                borderBottom: "1px solid var(--dsw-alias-border-l1, #eee)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontWeight: 600,
                fontSize: 14,
              },
            },
            React.createElement("span", null, "脚本库 · 待确认" + (count > 0 ? " (" + count + ")" : "")),
            React.createElement(
              "button",
              {
                onClick: onClose,
                style: { border: "none", background: "none", cursor: "pointer", fontSize: 16, color: "inherit" },
              },
              "✕"
            )
          ),
          // Body
          React.createElement(
            "div",
            { style: { padding: 8, overflowY: "auto", flex: 1 } },
            entries.length === 0
              ? React.createElement(
                  "div",
                  { style: { padding: 24, textAlign: "center", color: "var(--dsw-alias-label-tertiary, #999)" } },
                  "🎉 暂无待确认条目"
                )
              : entries.map((e) =>
                  React.createElement(
                    "div",
                    {
                      key: e.id,
                      style: {
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--dsw-alias-border-l1, #f0f0f0)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      },
                    },
                    React.createElement(
                      "div",
                      { style: { flex: 1, minWidth: 0 } },
                      React.createElement(
                        "div",
                        { style: { fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                        e.name
                      ),
                      React.createElement(
                        "div",
                        {
                          style: {
                            fontSize: 12,
                            color: "var(--dsw-alias-label-secondary, #666)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          },
                        },
                        `[${e.type}] ${e.summary}`
                      )
                    ),
                    React.createElement(
                      "button",
                      {
                        onClick: () => onApprove(e.id),
                        style: {
                          border: "1px solid var(--dsw-alias-border-l2, #ccc)",
                          background: "transparent",
                          borderRadius: 6,
                          padding: "4px 10px",
                          cursor: "pointer",
                          fontSize: 12,
                        },
                      },
                      "确认入库"
                    ),
                    React.createElement(
                      "button",
                      {
                        onClick: () => onDelete(e.id),
                        style: {
                          border: "1px solid var(--dsw-alias-border-l2, #ccc)",
                          background: "transparent",
                          borderRadius: 6,
                          padding: "4px 10px",
                          cursor: "pointer",
                          fontSize: 12,
                          color: "var(--dsw-alias-state-error-primary, #e5484d)",
                        },
                      },
                      "删除"
                    )
                  )
                )
          )
        )
      );
    }

    /** Minimal zod-compatible schema object (identity parse) for client-side
     *  descriptor codecs. The host is the authoritative validator; the browser
     *  only needs a codec whose mode is "strict" and whose parse() accepts the
     *  wire value. */
    function passthroughSchema() {
      return {
        _zod: { def: {}, constr: function () {}, traits: new Set() },
        parse: (value) => value,
        readonly: () => passthroughSchema(),
        safeParse: (value) => ({ success: true, data: value }),
      };
    }

    /** The scriptLibrary remote contribution (shape matches the generator's
     *  typert.remote-client output). */
    const TYPERT_REMOTE = {
      package: "dsh-script-library",
      descriptors: [
        {
          id: "dsh-script-library#scriptLibrary/listStaged",
          service: "scriptLibrary",
          namespace: "scriptLibrary",
          method: "listStaged",
          invocation: { kind: "direct" },
          parameters: [],
          result: { mode: "strict", typeSymbol: "dsh-script-library/types#StagedList", schema: passthroughSchema() },
          sourceLocation: { file: "packages/host/script-library/src/index.ts", line: 1, column: 1 },
        },
        {
          id: "dsh-script-library#scriptLibrary/countStaged",
          service: "scriptLibrary",
          namespace: "scriptLibrary",
          method: "countStaged",
          invocation: { kind: "direct" },
          parameters: [],
          result: { mode: "strict", typeSymbol: "dsh-script-library/types#StagedCount", schema: passthroughSchema() },
          sourceLocation: { file: "packages/host/script-library/src/index.ts", line: 1, column: 1 },
        },
        {
          id: "dsh-script-library#scriptLibrary/approveEntry",
          service: "scriptLibrary",
          namespace: "scriptLibrary",
          method: "approveEntry",
          invocation: { kind: "direct" },
          parameters: [
            {
              name: "id",
              wire: "id",
              type: "string",
              source: "json",
              codec: { mode: "strict", typeSymbol: "dsh-script-library/types#String", schema: passthroughSchema() },
            },
          ],
          result: { mode: "strict", typeSymbol: "dsh-script-library/types#MutationResult", schema: passthroughSchema() },
          sourceLocation: { file: "packages/host/script-library/src/index.ts", line: 1, column: 1 },
        },
        {
          id: "dsh-script-library#scriptLibrary/deleteEntry",
          service: "scriptLibrary",
          namespace: "scriptLibrary",
          method: "deleteEntry",
          invocation: { kind: "direct" },
          parameters: [
            {
              name: "id",
              wire: "id",
              type: "string",
              source: "json",
              codec: { mode: "strict", typeSymbol: "dsh-script-library/types#String", schema: passthroughSchema() },
            },
          ],
          result: { mode: "strict", typeSymbol: "dsh-script-library/types#MutationResult", schema: passthroughSchema() },
          sourceLocation: { file: "packages/host/script-library/src/index.ts", line: 1, column: 1 },
        },
      ],
    };

    /**
     * Direct RPC call to the host gateway — mirrors the connection carrier's
     * wire format (`POST {origin}/api/{namespace}/{method}`). This bypasses the
     * Cordis inject guard that would otherwise deadlock a self-mounted
     * namespace, and keeps the browser half independent of ctx.remote.
     */
    function rpc(namespace, method, args) {
      return fetch(new URL(`/api/${namespace}/${method}`, globalThis.location.origin), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "client-request",
          rpcId: `sl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          method: `${namespace}/${method}`,
          payload: { args: args || {} },
        }),
      })
        .then((response) => {
          if (!response.ok) throw new Error(`transport failure for ${namespace}/${method}: HTTP ${response.status}`);
          return response.json();
        })
        .then((full) => {
          const result = full.result;
          if (!result || typeof result !== "object") throw new Error(`bad rpc response for ${namespace}/${method}`);
          if (!result.ok) throw new Error(`rpc error: ${result.error && result.error.message || JSON.stringify(result.error)}`);
          return result.value;
        });
    }

    /**
     * Client plugin body.
     * @param ctx - client root context.
     */
    function apply(ctx) {
      try {
        // Locale strings (zh-first).
      ctx.effect(
        () =>
          ctx.locale.register(NS, {
            zh: {
              action: "脚本库",
              title: "脚本库 · 待确认",
              empty: "🎉 暂无待确认条目",
              approve: "确认入库",
              delete: "删除",
              error: "加载失败",
            },
            en: {
              action: "Script Library",
              title: "Script Library · Pending",
              empty: "🎉 No pending entries",
              approve: "Approve",
              delete: "Delete",
              error: "Load failed",
            },
          }),
        "script-library: dictionaries"
      );

      // Local panel state shared by the action row and the overlay.
      // A tiny external store: React components subscribe and re-render on
      // change (mirrors the official shell.overlay pattern).
      const state = { open: false, entries: [], count: 0 };
      const stateListeners = new Set();
      const setState = (patch) => {
        Object.assign(state, patch);
        for (const fn of [...stateListeners]) fn();
      };
      const stateSubscribe = (fn) => {
        stateListeners.add(fn);
        return () => stateListeners.delete(fn);
      };
      const stateSnapshot = () => state;

      /** Update the rendered badge in-place (the buttons' .sl-count span). */
      function updateBadge(count) {
        try {
          if (typeof document === "undefined") return;
          const c = document.querySelector(".sl-action .sl-count");
          if (!c) return;
          const n = count || 0;
          c.textContent = String(n);
          c.style.display = n > 0 ? "inline-flex" : "none";
          c.style.background = n > 0 ? "var(--dsw-alias-state-error-primary, #e5484d)" : "transparent";
        } catch (e) { /* noop */ }
      }

      async function refresh() {
        try {
          const data = await rpc("scriptLibrary", "listStaged", {});
          if (!data || typeof data !== "object") { latestEntries = []; setState({ entries: [], count: 0 }); updateBadge(0); return; }
          latestEntries = data.entries ?? [];
          setState({ entries: latestEntries, count: data.count ?? 0 });
          updateBadge(data.count ?? 0);
        } catch (err) {
          console.error("[script-library] listStaged failed:", err);
          setState({ entries: [], count: 0 });
        }
      }

      // Sidebar footer action: the entry point with the badge.
      ctx.slots.inject("sidebar.footer.action", () =>
        ctx.slots.register(
          {
            name: "sidebar.footer.action",
            id: "script-library",
            locale: NS,
            inject: () => ({
              count: state.count,
              onOpen: () => {
                void refresh().then(() => {
                  renderPanelDom(latestEntries, refresh);
                });
              },
            }),
          },
          (props) =>
            React.createElement(SidebarAction, {
              wide: props.wide,
              count: state.count,
              onOpen: props.onOpen,
              t: props.t,
              subscribe: stateSubscribe,
              getSnapshot: stateSnapshot,
            })
        )
      );

      // Refresh the badge periodically.
      void refresh();
      const iv = setInterval(() => void refresh(), 30000);
      ctx.effect(() => () => clearInterval(iv), "script-library: refresh timer");
      } catch (err) {
        if (typeof window !== "undefined") { window.__DSH_SL_APPLY_ERROR__ = String(err && err.message || err); window.__DSH_SL_APPLY_STACK__ = String(err && err.stack || ""); }
        console.error("[script-library] apply failed:", err);
        throw err;
      }
    }

    exports.SidebarAction = SidebarAction;
    exports.Panel = Panel;
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});