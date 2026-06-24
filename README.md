# Ghost Ping

Obsidian plugin that notifies when an uncreated note receives a new unresolved backlink after its total unresolved backlink count exceeds a configurable threshold.

## Behavior

- Uses Obsidian's metadata cache unresolved links.
- Takes an initial snapshot after metadata is resolved, so existing uncreated notes do not notify on startup.
- After Markdown metadata changes, compares the new unresolved backlink counts with the previous snapshot.
- Shows a notice when an uncreated note's count increased and the new count is greater than the configured threshold.

## Development

```bash
npm install
npm run build
npm test
```
