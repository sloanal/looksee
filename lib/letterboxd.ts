/**
 * Letterboxd has no public API for a member's lists, so importing goes through
 * the CSV export at letterboxd.com/settings/data. Every file in that export
 * shares the same shape — a `Name` column, usually `Year`, and a `Rating`
 * column on the files that carry opinions (ratings.csv, watched.csv) — so one
 * parser covers watchlist.csv and its siblings.
 *
 * Pure module: the browser parses the file to show a count before uploading,
 * and the import route re-validates the rows it is handed.
 */

/** A row of a Letterboxd export, reduced to what we can match on. */
export type LetterboxdRow = {
  name: string
  /** Release year, when the export includes one. */
  year: number | null
  /** 0.5–5 stars, only on exports that carry ratings. Null means "watchlist". */
  rating: number | null
}

/**
 * Ceiling on one import. Watchlists this long are rare; the cap keeps a single
 * import from spending thousands of TMDB lookups, and the most recently added
 * rows are the ones kept.
 */
export const LETTERBOXD_MAX_ROWS = 500

/** Rows per request, so each round trip stays well inside a function timeout. */
export const LETTERBOXD_BATCH_SIZE = 20

/** Guard against someone picking a whole export zip or an unrelated file. */
export const LETTERBOXD_MAX_FILE_BYTES = 5 * 1024 * 1024

/** Ceiling on how many rooms one import may fan out to. */
export const LETTERBOXD_MAX_ROOMS = 20

/** The two values UserMediaPreference.status can hold. */
export type ImportStatus = 'HAVE_NOT_SEEN' | 'ALREADY_SEEN'

/**
 * How the rows an export has no opinion of its own about should land. Both
 * halves are pickers in the import dialog; rows that do carry stars keep the
 * rating the export gave them.
 */
export type ImportDefaults = {
  status: ImportStatus
  /** 1 (Not excited), 3 (Neutral) or 5 (Excited). */
  excitement: number
}

/**
 * A film on a Letterboxd watchlist is already a statement of interest, so
 * "excited about something I haven't seen" is the starting point.
 */
export const LETTERBOXD_IMPORT_DEFAULTS: ImportDefaults = {
  status: 'HAVE_NOT_SEEN',
  excitement: 5,
}

const EXCITEMENT_VALUES = [1, 3, 5]

/**
 * Read the chosen defaults out of an untrusted body. Anything missing or
 * unrecognized falls back to LETTERBOXD_IMPORT_DEFAULTS field by field, which
 * is also what a client that predates the pickers gets. Status is accepted in
 * either case so the client can send the lowercase form the rating pickers use.
 */
export function parseImportDefaults(value: unknown): ImportDefaults {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const status = typeof input.status === 'string' ? input.status.toUpperCase() : ''
  const excitement = typeof input.excitement === 'number' ? input.excitement : NaN
  return {
    status: status === 'ALREADY_SEEN' || status === 'HAVE_NOT_SEEN'
      ? status
      : LETTERBOXD_IMPORT_DEFAULTS.status,
    excitement: EXCITEMENT_VALUES.includes(excitement)
      ? excitement
      : LETTERBOXD_IMPORT_DEFAULTS.excitement,
  }
}

export type LetterboxdParse =
  | {
    ok: true
    rows: LetterboxdRow[]
    /** True when the file carried star ratings (ratings.csv rather than watchlist.csv). */
    rated: boolean
    /** Rows dropped because they duplicated an earlier title. */
    duplicates: number
    /** Rows dropped because the file was longer than LETTERBOXD_MAX_ROWS. */
    truncated: number
  }
  | { ok: false; error: string }

const NOT_LETTERBOXD =
  "That doesn't look like a Letterboxd export. Unzip the download and pick watchlist.csv."

/**
 * Minimal RFC 4180 reader: quoted fields may contain commas, escaped quotes
 * (`""`) and newlines, which film titles occasionally do.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  // Skip a UTF-8 BOM so the first header cell still reads as "Date"/"Name".
  let index = text.charCodeAt(0) === 0xfeff ? 1 : 0

  for (; index < text.length; index++) {
    const char = text[index]
    if (quoted) {
      if (char !== '"') {
        field += char
      } else if (text[index + 1] === '"') {
        field += '"'
        index++
      } else {
        quoted = false
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function parseYear(raw: string | undefined): number | null {
  const year = parseInt((raw ?? '').trim(), 10)
  if (isNaN(year) || year < 1870 || year > 2200) return null
  return year
}

function parseRating(raw: string | undefined): number | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null
  const rating = parseFloat(trimmed)
  if (isNaN(rating) || rating < 0.5 || rating > 5) return null
  return rating
}

/**
 * Read a Letterboxd CSV export into matchable rows, newest last. Titles are
 * de-duplicated on name + year, and only the most recently added
 * LETTERBOXD_MAX_ROWS survive (exports are ordered oldest first).
 */
export function parseLetterboxdCsv(text: string): LetterboxdParse {
  const table = parseCsv(text).filter((row) => row.some((cell) => cell.trim().length > 0))
  if (table.length === 0) return { ok: false, error: 'That file is empty.' }

  const header = table[0].map((cell) => cell.trim().toLowerCase())
  const nameIndex = header.indexOf('name')
  const yearIndex = header.indexOf('year')
  const ratingIndex = header.indexOf('rating')
  if (nameIndex === -1) return { ok: false, error: NOT_LETTERBOXD }

  const seen = new Set<string>()
  const rows: LetterboxdRow[] = []
  let duplicates = 0

  for (const cells of table.slice(1)) {
    const name = (cells[nameIndex] ?? '').trim()
    if (!name) continue
    const year = yearIndex === -1 ? null : parseYear(cells[yearIndex])
    const key = `${name.toLowerCase()}|${year ?? ''}`
    if (seen.has(key)) {
      duplicates++
      continue
    }
    seen.add(key)
    rows.push({
      name,
      year,
      rating: ratingIndex === -1 ? null : parseRating(cells[ratingIndex]),
    })
  }

  if (rows.length === 0) {
    return { ok: false, error: "That export doesn't have any films in it." }
  }

  const truncated = Math.max(0, rows.length - LETTERBOXD_MAX_ROWS)
  return {
    ok: true,
    rows: truncated > 0 ? rows.slice(-LETTERBOXD_MAX_ROWS) : rows,
    rated: rows.some((row) => row.rating !== null),
    duplicates,
    truncated,
  }
}

/** Letterboxd's half-star scale folded onto the app's 1 / 3 / 5 excitement. */
export function excitementFromStars(stars: number): number {
  if (stars >= 4) return 5
  if (stars <= 2) return 1
  return 3
}

/** The preference fields one row turns into. */
export type ResolvedRow = {
  status: ImportStatus
  isWatched: boolean
  excitement: number
}

/**
 * Where one row lands. A row the export rated carries its own opinion —
 * already seen, with the stars folded onto excitement — and every other row
 * takes the defaults the caller picked in the import dialog. Callers also read
 * the status back to decide what may enter a room: only films the caller has
 * not seen are worth putting in front of everyone else.
 */
export function resolveImportRow(row: LetterboxdRow, defaults: ImportDefaults): ResolvedRow {
  if (row.rating !== null) {
    return {
      status: 'ALREADY_SEEN',
      isWatched: true,
      excitement: excitementFromStars(row.rating),
    }
  }
  return {
    status: defaults.status,
    isWatched: defaults.status === 'ALREADY_SEEN',
    excitement: defaults.excitement,
  }
}
