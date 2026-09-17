// Folds the two differences a reader would not call differences: letter
// case, and Unicode composition. macOS can hand file-system text over in a
// decomposed form while typed text normally arrives composed. toLowerCase,
// rather than toLocaleLowerCase, keeps matching independent of the user's
// locale.
export function canonicalSearchText(value: string): string {
  return value.normalize("NFC").toLowerCase();
}

// Whitespace inside a query is significant, but whitespace around it is not.
export function canonicalSearchQuery(value: string): string {
  return canonicalSearchText(value.trim());
}
