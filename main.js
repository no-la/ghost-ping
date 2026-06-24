var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => GhostPing
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/backlinks.ts
function collectMissingNoteBacklinkCounts(unresolvedLinks) {
  var _a;
  const counts = /* @__PURE__ */ new Map();
  for (const linksBySource of Object.values(unresolvedLinks)) {
    for (const [linktext, count] of Object.entries(linksBySource)) {
      if (count <= 0)
        continue;
      counts.set(linktext, ((_a = counts.get(linktext)) != null ? _a : 0) + count);
    }
  }
  return counts;
}
function collectMissingNoteBacklinkSources(unresolvedLinks) {
  var _a;
  const sources = /* @__PURE__ */ new Map();
  for (const [sourcePath, linksBySource] of Object.entries(unresolvedLinks)) {
    for (const [linktext, count] of Object.entries(linksBySource)) {
      if (count <= 0)
        continue;
      if (!sources.has(linktext))
        sources.set(linktext, /* @__PURE__ */ new Set());
      (_a = sources.get(linktext)) == null ? void 0 : _a.add(sourcePath);
    }
  }
  return sources;
}
function findNewOverThresholdMissingNoteBacklinks(previousCounts, currentCounts, threshold, unresolvedLinks) {
  var _a, _b;
  const sources = collectMissingNoteBacklinkSources(unresolvedLinks);
  const changes = [];
  for (const [linktext, currentCount] of currentCounts) {
    const previousCount = (_a = previousCounts.get(linktext)) != null ? _a : 0;
    const addedCount = currentCount - previousCount;
    if (addedCount > 0 && currentCount > threshold) {
      changes.push({
        linktext,
        currentCount,
        previousCount,
        addedCount,
        sources: Array.from((_b = sources.get(linktext)) != null ? _b : []).sort()
      });
    }
  }
  return changes.sort((a, b) => b.currentCount - a.currentCount || a.linktext.localeCompare(b.linktext));
}

// main.ts
var DEFAULT_SETTINGS = {
  threshold: 3,
  noticeDurationMs: 1e4,
  debounceMs: 150
};
var GhostPing = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.previousCounts = /* @__PURE__ */ new Map();
    this.metadataReady = false;
    this.initialSnapshotTimer = null;
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new GhostPingSettingTab(this.app, this));
    this.updateScanDebounce();
    this.registerEvent(
      this.app.metadataCache.on("resolved", () => {
        this.handleMetadataResolved();
      })
    );
    this.registerEvent(
      this.app.metadataCache.on("resolve", () => {
        if (this.metadataReady)
          this.scanAfterResolve();
      })
    );
    this.addCommand({
      id: "scan-missing-note-backlinks",
      name: "Scan ghost links",
      callback: () => this.scanForNewBacklinks()
    });
    this.addCommand({
      id: "show-top-ghost-links",
      name: "Show top ghost links",
      callback: () => this.showTopGhostLinks()
    });
    this.app.workspace.onLayoutReady(() => {
      if (!this.metadataReady) {
        this.initialSnapshotTimer = window.setTimeout(() => {
          this.captureInitialSnapshot();
        }, 1e3);
      }
    });
    this.register(() => {
      if (this.initialSnapshotTimer !== null)
        window.clearTimeout(this.initialSnapshotTimer);
    });
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  updateScanDebounce() {
    this.scanAfterResolve = (0, import_obsidian.debounce)(
      () => this.scanForNewBacklinks(),
      this.settings.debounceMs,
      true
    );
  }
  collectCurrentCounts() {
    return collectMissingNoteBacklinkCounts(
      this.app.metadataCache.unresolvedLinks
    );
  }
  handleMetadataResolved() {
    if (this.metadataReady) {
      this.scanAfterResolve();
      return;
    }
    this.captureInitialSnapshot();
  }
  captureInitialSnapshot() {
    if (this.initialSnapshotTimer !== null) {
      window.clearTimeout(this.initialSnapshotTimer);
      this.initialSnapshotTimer = null;
    }
    this.previousCounts = this.collectCurrentCounts();
    this.metadataReady = true;
  }
  scanForNewBacklinks() {
    const unresolvedLinks = this.app.metadataCache.unresolvedLinks;
    const currentCounts = collectMissingNoteBacklinkCounts(unresolvedLinks);
    const changes = findNewOverThresholdMissingNoteBacklinks(
      this.previousCounts,
      currentCounts,
      this.settings.threshold,
      unresolvedLinks
    );
    for (const change of changes) {
      const added = change.addedCount === 1 ? "1 new link" : `${change.addedCount} new links`;
      new import_obsidian.Notice(
        `Ghost note "${change.linktext}" now has ${change.currentCount} backlinks (${added}).`,
        this.settings.noticeDurationMs
      );
    }
    this.previousCounts = currentCounts;
  }
  showTopGhostLinks() {
    const counts = Array.from(this.collectCurrentCounts()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
    if (counts.length === 0) {
      new import_obsidian.Notice("Ghost Ping: no ghost links found.", this.settings.noticeDurationMs);
      return;
    }
    new import_obsidian.Notice(
      `Ghost Ping: ${counts.map(([linktext, count]) => `${linktext}: ${count}`).join(", ")}`,
      this.settings.noticeDurationMs
    );
  }
};
var GhostPingSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Backlink threshold").setDesc("Notify when a ghost note receives a new backlink and its total unresolved backlinks are greater than this number.").addText(
      (text) => text.setPlaceholder(String(DEFAULT_SETTINGS.threshold)).setValue(String(this.plugin.settings.threshold)).onChange(async (value) => {
        const threshold = Number.parseInt(value, 10);
        if (Number.isFinite(threshold) && threshold >= 0) {
          this.plugin.settings.threshold = threshold;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName("Notice duration (ms)").setDesc("How long notifications stay visible.").addText(
      (text) => text.setPlaceholder(String(DEFAULT_SETTINGS.noticeDurationMs)).setValue(String(this.plugin.settings.noticeDurationMs)).onChange(async (value) => {
        const duration = Number.parseInt(value, 10);
        if (Number.isFinite(duration) && duration > 0) {
          this.plugin.settings.noticeDurationMs = duration;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName("Scan debounce (ms)").setDesc("How long Ghost Ping waits after link metadata updates before scanning. Lower values feel faster; higher values reduce repeated scans.").addText(
      (text) => text.setPlaceholder(String(DEFAULT_SETTINGS.debounceMs)).setValue(String(this.plugin.settings.debounceMs)).onChange(async (value) => {
        const debounceMs = Number.parseInt(value, 10);
        if (Number.isFinite(debounceMs) && debounceMs >= 0) {
          this.plugin.settings.debounceMs = debounceMs;
          this.plugin.updateScanDebounce();
          await this.plugin.saveSettings();
        }
      })
    );
  }
};
