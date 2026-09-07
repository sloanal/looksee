// Built at runtime because the tsconfig target predates the `u` flag.
const NON_ALNUM = new RegExp('[^\\p{L}\\p{N}\\s]+', 'gu')
const COMBINING_MARKS = /[\u0300-\u036f]/g
const LEADING_ARTICLE = /^(?:the|a|an) /

/** Lowercase, strip diacritics, collapse punctuation and whitespace to single spaces. */
export function foldSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(NON_ALNUM, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** foldSearchText plus dropping a leading article, unless the article is all there is. */
export function normalizeSearchText(value: string): string {
  const folded = foldSearchText(value)
  const stripped = folded.replace(LEADING_ARTICLE, '')
  return stripped.length > 0 ? stripped : folded
}

export function searchTokens(query: string): string[] {
  return normalizeSearchText(query).split(' ').filter(Boolean)
}

// "spiderman" must find "Spider-Man", so a field is also compared with its spaces removed.
const haystacksFor = (field: string): string[] => {
  const folded = foldSearchText(field)
  if (!folded) return []
  const compact = folded.replace(/ /g, '')
  return compact === folded ? [folded] : [folded, compact]
}

const tokenInHaystacks = (token: string, haystacks: string[]) =>
  haystacks.some((haystack) => haystack.indexOf(token) !== -1)

/** True when every token of the query appears in at least one field. An empty query matches. */
export function matchesQuery(fields: string[], query: string): boolean {
  return matchQueryGroups([['match', fields]], query) !== null
}

/** True when at least one token of the query appears in the field. */
export function matchesAnyToken(field: string, query: string): boolean {
  const haystacks = haystacksFor(field)
  return searchTokens(query).some((token) => tokenInHaystacks(token, haystacks))
}

/**
 * matchesQuery over named groups of fields: every token must appear in some field of
 * some group. Returns the groups that contained at least one token, in the order given,
 * or null when a token matched nowhere.
 */
export function matchQueryGroups<K extends string>(
  groups: Array<[K, string[]]>,
  query: string,
): K[] | null {
  const tokens = searchTokens(query)
  const prepared = groups.map(([key, fields]) => ({
    key,
    haystacks: fields.map(haystacksFor).filter((h) => h.length > 0),
  }))
  if (tokens.length === 0) return []

  const hit = prepared.map(() => false)
  for (let t = 0; t < tokens.length; t++) {
    let found = false
    for (let g = 0; g < prepared.length; g++) {
      if (prepared[g].haystacks.some((h) => tokenInHaystacks(tokens[t], h))) {
        hit[g] = true
        found = true
      }
    }
    if (!found) return null
  }
  return prepared.filter((_, g) => hit[g]).map((group) => group.key)
}
