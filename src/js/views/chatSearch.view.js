import { html, render } from "/js/lib/lit-html.js";
import { View } from "/js/views/view.js";
import { pageEffect } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { Signal } from "/js/signals.js";
import { getGroupConvoDetails, getDisplayName } from "/js/dataHelpers.js";
import MiniSearch from "/js/lib/minisearch.js";

// ── Helpers ──

function convoLabel(convo, currentDid) {
  const group = getGroupConvoDetails(convo);
  if (group?.name) return group.name;
  return (
    (convo.members ?? [])
      .filter((m) => m.did !== currentDid)
      .map((m) => getDisplayName(m) || m.handle)
      .join(", ") || convo.id
  );
}

function msgText(m) {
  const t =
    m.$type === "chat.bsky.convo.defs#messageView"
      ? m.text
      : m.$type?.startsWith("chat.bsky.convo.defs#deletedMessage")
        ? "[deleted]"
        : "[unknown]";
  return (t || "").substring(0, 300);
}

function senderLabel(did, convo, dataLayer) {
  const m = (convo?.members ?? []).find((x) => x.did === did);
  if (m) return getDisplayName(m) || m.handle || did;
  const profile = dataLayer?.derived?.$hydratedProfiles?.get(did);
  if (profile) return getDisplayName(profile) || profile.handle || did;
  return did;
}

function safe(s) {
  return (s || "").replace(/[\u{10000}-\u{10FFFF}]/gu, "").trim();
}

// ── View ──

class ChatSearchView extends View {
  async render({ root, layout, context: { dataLayer } }) {
    // State
    const state = {
      $convos: new Signal.State(null),
      $selectedConvoId: new Signal.State(""),
      $pulling: new Signal.State(false),
      $pullFetched: new Signal.State(0),
      $pullTotal: new Signal.State(null),
      $pullError: new Signal.State(""),
      $pullDays: new Signal.State(7),
      $query: new Signal.State(""),
      $senderFilter: new Signal.State(""),
      $timeFilter: new Signal.State("all"),
      $messages: new Signal.State(null), // { convoId, messages[], index }
    };

    const currentUser = dataLayer.derived.$currentUser.get();
    const currentDid = currentUser?.did;

    // ── Data loading ──

    async function loadConvos() {
      await dataLayer.declarative.ensureCurrentUser();
      await dataLayer.requests.loadConvoList({ reload: true, limit: 100 });
      const list = dataLayer.derived.$convoList.get();
      state.$convos.set(list ?? []);
    }

    async function pullMessages() {
      const convoId = state.$selectedConvoId.get();
      if (!convoId || state.$pulling.get()) return;
      state.$pulling.set(true);
      state.$pullFetched.set(0);
      state.$pullTotal.set(null);
      state.$pullError.set("");

      try {
        const days = state.$pullDays.get();
        const since =
          days > 0
            ? new Date(Date.now() - days * 86400000).toISOString()
            : null;

        // Track existing message IDs to avoid re-fetching
        const existing = state.$messages.get();
        const existingIds = new Set();
        let oldestExisting = null;
        if (existing && existing.convoId === convoId) {
          for (const m of existing.messages) {
            existingIds.add(m.id);
            const t = new Date(m.sentAt).getTime();
            if (oldestExisting === null || t < oldestExisting)
              oldestExisting = t;
          }
          // If time range covers only what we already have, skip entirely
          if (since) {
            const cutoff = new Date(since).getTime();
            if (oldestExisting !== null && oldestExisting >= cutoff) {
              state.$pulling.set(false);
              state.$pullFetched.set(existing.messages.length);
              state.$pullTotal.set(existing.messages.length);
              return;
            }
          }
        }

        const all = existing ? [...existing.messages] : [];
        let cursor = null;
        let done = false;
        let pages = 0;
        let seenNew = false;

        while (!done && pages < 100) {
          await dataLayer.requests.loadConvoMessages(convoId, {
            reload: !cursor,
            limit: 100,
          });
          const data = dataLayer.derived.$convoMessages.get(convoId);
          if (!data) break;

          const msgs = data.messages ?? [];
          for (const m of msgs) {
            // Skip if we already have this message
            if (existingIds.has(m.id)) {
              if (seenNew) done = true;
              continue;
            }
            // Filter by time range
            if (
              since &&
              new Date(m.sentAt).getTime() < new Date(since).getTime()
            ) {
              done = true;
              continue;
            }
            all.push(m);
            existingIds.add(m.id);
            seenNew = true;
          }
          state.$pullFetched.set(all.length);
          pages++;

          // If we hit a page with no new messages, assume we're past the new stuff
          if (!seenNew && pages >= 2) done = true;
          if (done) break;
          cursor = data.cursor;
          if (!cursor) break;
        }

        // Sort by time ascending for consistent display
        all.sort(
          (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
        );

        // Build MiniSearch index
        const index = new MiniSearch({
          fields: ["text", "sender"],
          storeFields: ["id", "senderDid", "sender", "text", "sentAt"],
          searchOptions: { fuzzy: 0.2, prefix: true },
        });
        index.addAll(
          all.map((m) => ({
            id: m.id,
            senderDid: m.sender?.did ?? "",
            sender: safe(
              senderLabel(
                m.sender?.did,
                state.$convos.get()?.find((c) => c.id === convoId),
                dataLayer,
              ),
            ),
            text: safe(msgText(m)),
            sentAt: m.sentAt,
          })),
        );

        state.$messages.set({ convoId, messages: all, index });
        state.$pullTotal.set(all.length);
      } catch (err) {
        state.$pullError.set(err.message || String(err));
      } finally {
        state.$pulling.set(false);
      }
    }

    // ── Search ──

    function getResults() {
      const data = state.$messages.get();
      const q = state.$query.get().trim();
      const senderF = state.$senderFilter.get().trim();
      const timeF = state.$timeFilter.get();

      if (!data || !q) return [];
      let results = data.index.search(q);
      if (senderF) {
        results = results.filter(
          (r) => r.senderDid === senderF || r.sender === senderF,
        );
      }
      if (timeF !== "all") {
        const days = parseInt(timeF);
        const cutoff = new Date(Date.now() - days * 86400000).getTime();
        results = results.filter((r) => new Date(r.sentAt).getTime() >= cutoff);
      }
      return results;
    }

    // ── Render ──

    function senderOptions(convo) {
      const data = state.$messages.get();
      if (!data) return [];
      const senders = new Map();
      for (const m of data.messages) {
        const did = m.sender?.did;
        if (did && !senders.has(did))
          senders.set(did, senderLabel(did, convo, dataLayer));
      }
      return [...senders.entries()].map(([did, label]) => ({ did, label }));
    }

    pageEffect(root, () => {
      const convos = state.$convos.get();
      const selectedId = state.$selectedConvoId.get();
      const selectedConvo = convos?.find((c) => c.id === selectedId);
      const pulling = state.$pulling.get();
      const pullFetched = state.$pullFetched.get();
      const pullTotal = state.$pullTotal.get();
      const pullError = state.$pullError.get();
      const pullDays = state.$pullDays.get();
      const query = state.$query.get();
      const senderFilter = state.$senderFilter.get();
      const timeFilter = state.$timeFilter.get();
      const data = state.$messages.get();
      const results = getResults();
      const senders = selectedConvo ? senderOptions(selectedConvo) : [];

      const hasData = data && data.messages.length > 0;
      const showSearch = hasData && !pulling;

      render(
        html`<div id="chat-search-view">
          ${headerTemplate({
            title: "Chat Search",
            leftButton: "menu",
            onClickMenuButton: () => layout.openSidebar(),
          })}
          <main>
            <div class="chat-search-container">
              <section class="chat-search-section">
                <div class="chat-search-row">
                  <select
                    class="chat-search-select chat-search-select-full"
                    .value=${selectedId}
                    @change=${(e) => {
                      state.$selectedConvoId.set(e.target.value);
                      state.$messages.set(null);
                      state.$pullFetched.set(0);
                      state.$pullTotal.set(null);
                      state.$pullError.set("");
                      state.$query.set("");
                    }}
                  >
                    <option value="">Select conversation…</option>
                    ${(convos ?? []).map(
                      (c) =>
                        html`<option value=${c.id}>
                          ${convoLabel(c, currentDid)}
                        </option>`,
                    )}
                  </select>
                  <select
                    class="chat-search-select"
                    .value=${String(pullDays)}
                    @change=${(e) =>
                      state.$pullDays.set(Number(e.target.value))}
                  >
                    <option value="1">1 day</option>
                    <option value="7">7 days</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="0">All time</option>
                  </select>
                  <button
                    class="rounded-button rounded-button-primary"
                    ?disabled=${!selectedId || pulling}
                    @click=${pullMessages}
                  >
                    ${pulling ? "Building…" : "Build cache"}
                  </button>
                </div>
                ${pullError
                  ? html`<p class="chat-search-error">${pullError}</p>`
                  : ""}
                ${pulling
                  ? html`<p class="chat-search-status">
                      Indexed ${pullFetched} messages…
                    </p>`
                  : pullTotal !== null
                    ? html`<p class="chat-search-status">
                        ${pullTotal} messages loaded
                      </p>`
                    : ""}
              </section>

              ${showSearch
                ? html`
                    <section class="chat-search-section">
                      <div class="chat-search-row">
                        <input
                          type="text"
                          class="chat-search-input"
                          placeholder="Search messages…"
                          .value=${query}
                          @input=${(e) => state.$query.set(e.target.value)}
                        />
                      </div>
                      <div class="chat-search-row">
                        <select
                          class="chat-search-select chat-search-select-full"
                          .value=${senderFilter}
                          @change=${(e) =>
                            state.$senderFilter.set(e.target.value)}
                        >
                          <option value="">All senders</option>
                          ${senders.map(
                            (s) =>
                              html`<option value=${s.did}>${s.label}</option>`,
                          )}
                        </select>
                        ${["7d", "30d", "90d", "all"].map(
                          (t) =>
                            html`<button
                              class="chat-search-time-btn ${timeFilter === t
                                ? "active"
                                : ""}"
                              @click=${() => state.$timeFilter.set(t)}
                            >
                              ${t === "all" ? "All" : t}
                            </button>`,
                        )}
                      </div>
                      ${query
                        ? html`<p class="chat-search-count">
                            ${results.length}
                            result${results.length !== 1 ? "s" : ""}
                          </p>`
                        : html`<p class="chat-search-count">
                            ${data.messages.length} messages indexed — start
                            typing to search
                          </p>`}
                    </section>

                    <section class="chat-search-results">
                      ${results.length === 0 && query
                        ? html`<p class="chat-search-empty">
                            No matching messages.
                          </p>`
                        : results.map(
                            (r) =>
                              html`<div class="chat-search-result">
                                <div class="chat-search-result-header">
                                  <span class="chat-search-result-sender"
                                    >${safe(r.sender)}</span
                                  ><span class="chat-search-result-match"
                                    >score ${r.score.toFixed(1)}</span
                                  >
                                </div>
                                <div class="chat-search-result-text">
                                  ${safe(r.text)}
                                </div>
                                <div class="chat-search-result-time">
                                  ${new Date(r.sentAt).toLocaleString()}
                                </div>
                              </div>`,
                          )}
                    </section>
                  `
                : !pulling && pullTotal === null
                  ? html`<p class="chat-search-empty">
                      Select a conversation and click Build cache to load
                      messages.
                    </p>`
                  : ""}
            </div>
          </main>
        </div>`,
        root,
      );
    });

    root.addEventListener("page-enter", () => {
      loadConvos();
    });
  }
}

export default new ChatSearchView();
