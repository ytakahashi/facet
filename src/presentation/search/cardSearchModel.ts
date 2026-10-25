import { isSameCardPath } from "../../domain/boardPath.ts";
import {
  type CardSearchHit,
  filterCardHitsByTitle,
} from "../../domain/cardSearch.ts";
import { canonicalSearchQuery } from "../../domain/searchText.ts";

// "results" is the board-order list: typed results, or every card when there
// is no history to put above it.
export type CardSearchSectionKind = "recent" | "all" | "results";

export type CardSearchMode = "search" | "recent";

export interface CardSearchOptionRow {
  kind: "option";
  key: string;
  id: string;
  hit: CardSearchHit;
  optionIndex: number;
}

// The card already open in the viewer. It stays in the recent list so the
// order reads true, but choosing it would only reopen what is on screen.
export interface CardSearchCurrentRow {
  kind: "current";
  key: string;
  id: string;
  hit: CardSearchHit;
}

export type CardSearchRow = CardSearchOptionRow | CardSearchCurrentRow;

export interface CardSearchSection {
  kind: CardSearchSectionKind;
  // Headings only tell sections apart. A list shown on its own - the plain
  // results, or recent mode's single list under the dialog's title - would
  // only restate what it is.
  labelled: boolean;
  rows: CardSearchRow[];
}

export interface CardSearchModel {
  sections: CardSearchSection[];
  // The selectable rows in display order, as the same objects the sections
  // hold. The selected index, the arrow keys, Enter and the active descendant
  // all index into this rather than into the rendered rows.
  options: CardSearchOptionRow[];
}

export interface CardSearchModelInput {
  mode: CardSearchMode;
  query: string;
  // Board-order title search results for the query. Ignored in recent mode,
  // which never looks beyond the history.
  results: readonly CardSearchHit[];
  // Recently opened cards, most recent first, already resolved on the board.
  recent: readonly CardSearchHit[];
  currentPath: string | undefined;
}

// In search mode, recent cards are offered only before anything is typed:
// once there is a query, board order keeps the same query giving the same list.
//
// The first selectable recent card comes first among the options, so index 0
// is always the right initial selection. Before filtering, it is the card
// Command-[ would switch to. Search mode falls through to the first card of
// the board when history has no selectable card; recent mode never does.
export function buildCardSearchModel({
  mode,
  query,
  results,
  recent,
  currentPath,
}: CardSearchModelInput): CardSearchModel {
  const options: CardSearchOptionRow[] = [];

  function buildSection(
    kind: CardSearchSectionKind,
    labelled: boolean,
    hits: readonly CardSearchHit[],
    isCurrent: (hit: CardSearchHit) => boolean,
  ): CardSearchSection {
    const rows = hits.map((hit, position): CardSearchRow => {
      // A card can appear in both Recent and All cards, so the section is
      // part of every key and ID. Positions keep IDs valid whatever
      // characters a path holds.
      const key = `${kind}:${hit.card.path}`;
      const id = `card-search-${kind}-${position}`;
      if (isCurrent(hit)) return { kind: "current", key, id, hit };
      const row: CardSearchOptionRow = {
        kind: "option",
        key,
        id,
        hit,
        optionIndex: options.length,
      };
      options.push(row);
      return row;
    });
    return { kind, labelled, rows };
  }

  // A reload can leave the current card anywhere in history.
  const isCurrent = (hit: CardSearchHit) =>
    currentPath !== undefined && isSameCardPath(hit.card.path, currentPath);
  if (mode === "recent") {
    const hits = filterCardHitsByTitle(recent, query);
    return {
      sections:
        hits.length === 0
          ? []
          : [buildSection("recent", false, hits, isCurrent)],
      options,
    };
  }

  const neverCurrent = () => false;
  if (
    results.length === 0 ||
    canonicalSearchQuery(query) !== "" ||
    recent.length === 0
  ) {
    return {
      sections:
        results.length === 0
          ? []
          : [buildSection("results", false, results, neverCurrent)],
      options,
    };
  }

  return {
    sections: [
      buildSection("recent", true, recent, isCurrent),
      // Only the recent list leaves the current card out: in the full list it
      // stays selectable, as it is in typed results.
      buildSection("all", true, results, neverCurrent),
    ],
    options,
  };
}
