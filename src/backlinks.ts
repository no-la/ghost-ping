export type UnresolvedLinks = Record<string, Record<string, number>>;

export interface MissingNoteBacklinkChange {
	linktext: string;
	currentCount: number;
	previousCount: number;
	addedCount: number;
	sources: string[];
}

export function collectMissingNoteBacklinkCounts(unresolvedLinks: UnresolvedLinks): Map<string, number> {
	const counts = new Map<string, number>();

	for (const linksBySource of Object.values(unresolvedLinks)) {
		for (const [linktext, count] of Object.entries(linksBySource)) {
			if (count <= 0) continue;
			counts.set(linktext, (counts.get(linktext) ?? 0) + count);
		}
	}

	return counts;
}

export function collectMissingNoteBacklinkSources(unresolvedLinks: UnresolvedLinks): Map<string, Set<string>> {
	const sources = new Map<string, Set<string>>();

	for (const [sourcePath, linksBySource] of Object.entries(unresolvedLinks)) {
		for (const [linktext, count] of Object.entries(linksBySource)) {
			if (count <= 0) continue;
			if (!sources.has(linktext)) sources.set(linktext, new Set());
			sources.get(linktext)?.add(sourcePath);
		}
	}

	return sources;
}

export function findNewOverThresholdMissingNoteBacklinks(
	previousCounts: Map<string, number>,
	currentCounts: Map<string, number>,
	threshold: number,
	unresolvedLinks: UnresolvedLinks,
): MissingNoteBacklinkChange[] {
	const sources = collectMissingNoteBacklinkSources(unresolvedLinks);
	const changes: MissingNoteBacklinkChange[] = [];

	for (const [linktext, currentCount] of currentCounts) {
		const previousCount = previousCounts.get(linktext) ?? 0;
		const addedCount = currentCount - previousCount;

		if (addedCount > 0 && currentCount > threshold) {
			changes.push({
				linktext,
				currentCount,
				previousCount,
				addedCount,
				sources: Array.from(sources.get(linktext) ?? []).sort(),
			});
		}
	}

	return changes.sort((a, b) => b.currentCount - a.currentCount || a.linktext.localeCompare(b.linktext));
}
