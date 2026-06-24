import { describe, expect, it } from "vitest";
import {
	collectMissingNoteBacklinkCounts,
	findNewOverThresholdMissingNoteBacklinks,
} from "../src/backlinks";

describe("ghost link aggregation", () => {
	it("counts unresolved links across source files", () => {
		const counts = collectMissingNoteBacklinkCounts({
			"Daily/2026-06-24.md": {
				"Project Alpha": 2,
				"Inbox Idea": 1,
			},
			"Notes/source.md": {
				"Project Alpha": 1,
			},
		});

		expect(counts.get("Project Alpha")).toBe(3);
		expect(counts.get("Inbox Idea")).toBe(1);
	});

	it("reports only links that increased beyond the threshold", () => {
		const previous = new Map([
			["Project Alpha", 3],
			["Inbox Idea", 5],
			["Stable Missing", 6],
		]);
		const current = collectMissingNoteBacklinkCounts({
			"Daily/2026-06-24.md": {
				"Project Alpha": 4,
				"Inbox Idea": 5,
				"Stable Missing": 6,
				"Below Threshold": 2,
			},
		});

		const changes = findNewOverThresholdMissingNoteBacklinks(
			previous,
			current,
			3,
			{
				"Daily/2026-06-24.md": {
					"Project Alpha": 4,
					"Inbox Idea": 5,
					"Stable Missing": 6,
					"Below Threshold": 2,
				},
			},
		);

		expect(changes).toEqual([
			{
				linktext: "Project Alpha",
				currentCount: 4,
				previousCount: 3,
				addedCount: 1,
				sources: ["Daily/2026-06-24.md"],
			},
		]);
	});
});
