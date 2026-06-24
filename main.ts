import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	debounce,
} from "obsidian";
import {
	UnresolvedLinks,
	collectMissingNoteBacklinkCounts,
	findNewOverThresholdMissingNoteBacklinks,
} from "./src/backlinks";

interface GhostPingSettings {
	threshold: number;
	noticeDurationMs: number;
}

const DEFAULT_SETTINGS: GhostPingSettings = {
	threshold: 3,
	noticeDurationMs: 10_000,
};

export default class GhostPing extends Plugin {
	settings: GhostPingSettings;
	private previousCounts = new Map<string, number>();
	private metadataReady = false;
	private scanAfterResolve: () => void;
	private initialSnapshotTimer: number | null = null;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new GhostPingSettingTab(this.app, this));

		this.scanAfterResolve = debounce(
			() => this.scanForNewBacklinks(),
			500,
			true,
		);

		this.registerEvent(
			this.app.metadataCache.on("resolved", () => {
				this.handleMetadataResolved();
			}),
		);

		this.registerEvent(
			this.app.metadataCache.on("resolve", () => {
				if (this.metadataReady) this.scanAfterResolve();
			}),
		);

		this.addCommand({
			id: "scan-missing-note-backlinks",
			name: "Scan ghost links",
			callback: () => this.scanForNewBacklinks(),
		});

		this.addCommand({
			id: "show-top-ghost-links",
			name: "Show top ghost links",
			callback: () => this.showTopGhostLinks(),
		});

		this.app.workspace.onLayoutReady(() => {
			if (!this.metadataReady) {
				this.initialSnapshotTimer = window.setTimeout(() => {
					this.captureInitialSnapshot();
				}, 1_000);
			}
		});

		this.register(() => {
			if (this.initialSnapshotTimer !== null) window.clearTimeout(this.initialSnapshotTimer);
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private collectCurrentCounts(): Map<string, number> {
		return collectMissingNoteBacklinkCounts(
			this.app.metadataCache.unresolvedLinks as UnresolvedLinks,
		);
	}

	private handleMetadataResolved(): void {
		if (this.metadataReady) {
			this.scanAfterResolve();
			return;
		}

		this.captureInitialSnapshot();
	}

	private captureInitialSnapshot(): void {
		if (this.initialSnapshotTimer !== null) {
			window.clearTimeout(this.initialSnapshotTimer);
			this.initialSnapshotTimer = null;
		}
		this.previousCounts = this.collectCurrentCounts();
		this.metadataReady = true;
	}

	private scanForNewBacklinks(): void {
		const unresolvedLinks = this.app.metadataCache.unresolvedLinks as UnresolvedLinks;
		const currentCounts = collectMissingNoteBacklinkCounts(unresolvedLinks);
		const changes = findNewOverThresholdMissingNoteBacklinks(
			this.previousCounts,
			currentCounts,
			this.settings.threshold,
			unresolvedLinks,
		);

		for (const change of changes) {
			const added = change.addedCount === 1 ? "1 new link" : `${change.addedCount} new links`;
			new Notice(
				`Ghost note "${change.linktext}" now has ${change.currentCount} backlinks (${added}).`,
				this.settings.noticeDurationMs,
			);
		}

		this.previousCounts = currentCounts;
	}

	private showTopGhostLinks(): void {
		const counts = Array.from(this.collectCurrentCounts())
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.slice(0, 5);

		if (counts.length === 0) {
			new Notice("Ghost Ping: no ghost links found.", this.settings.noticeDurationMs);
			return;
		}

		new Notice(
			`Ghost Ping: ${counts.map(([linktext, count]) => `${linktext}: ${count}`).join(", ")}`,
			this.settings.noticeDurationMs,
		);
	}
}

class GhostPingSettingTab extends PluginSettingTab {
	plugin: GhostPing;

	constructor(app: App, plugin: GhostPing) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Backlink threshold")
			.setDesc("Notify when a ghost note receives a new backlink and its total unresolved backlinks are greater than this number.")
			.addText((text) =>
				text
					.setPlaceholder(String(DEFAULT_SETTINGS.threshold))
					.setValue(String(this.plugin.settings.threshold))
					.onChange(async (value) => {
						const threshold = Number.parseInt(value, 10);
						if (Number.isFinite(threshold) && threshold >= 0) {
							this.plugin.settings.threshold = threshold;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName("Notice duration (ms)")
			.setDesc("How long notifications stay visible.")
			.addText((text) =>
				text
					.setPlaceholder(String(DEFAULT_SETTINGS.noticeDurationMs))
					.setValue(String(this.plugin.settings.noticeDurationMs))
					.onChange(async (value) => {
						const duration = Number.parseInt(value, 10);
						if (Number.isFinite(duration) && duration > 0) {
							this.plugin.settings.noticeDurationMs = duration;
							await this.plugin.saveSettings();
						}
					}),
			);
	}
}
