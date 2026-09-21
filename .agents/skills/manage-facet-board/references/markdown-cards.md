# Markdown cards

A Card is a reference from a board to a plain Markdown file. Facet does not put
board position, priority, labels, or other task-management data into the
Markdown file.

## File location and title

Card Markdown must be at or below the board root and use a `.md` suffix. A Card
stores that file's board-relative path.

Facet resolves the displayed title in this order:

1. The Card's optional `title` field in the board
2. The first trimmed line containing `#`, whitespace, and non-empty text
3. The Markdown filename without its `.md` suffix

The title scan is line-based rather than a full Markdown parse, so a matching
line inside a fenced code block also counts. When Facet creates a Markdown file,
it puts a level-one heading first. Other tools should likewise put the intended
`# Title` at the beginning, before any other line with that form, unless the
board's explicit `title` is intentionally authoritative.

Use the lowercase `.md` suffix for generated files. Facet accepts an uppercase
variant when adding or linking a Markdown file, but the filename fallback
removes only a lowercase `.md` suffix from the displayed title.

## Links between cards

Facet follows a Markdown link in Preview when all of these are true:

- Its destination is relative to the source Card's directory.
- The path resolves within the board root.
- The destination has a case-insensitive `.md` suffix.
- The current Board contains a Card for the resolved path.

Queries and fragments do not participate in Card path lookup. Percent-encoded
path content is decoded before the path is normalized. Use a path relative to
the source Card rather than one relative to the board root.

When generating a link, percent-encode path characters that Markdown or URL
parsing would otherwise treat as syntax. Preserve `/` as the path separator and
escape `\\`, `[` and `]` in link text.

Example from `projects/search-plan.md` to `research/query syntax.md`:

```markdown
[Query syntax](../research/query%20syntax.md)
```

Other links remain visible as text in Preview but do not navigate the WebView.
Images likewise render as alt text and do not load a resource.
