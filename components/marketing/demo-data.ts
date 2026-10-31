/*
 * Made-up titles and people for the landing page demos. Nothing here touches
 * real data; the ranking in `pickFor` mirrors lib/recommendations.ts (most
 * people interested first, then average excitement) so the demos tell the
 * truth about how the app chooses.
 */

export type Person = 'you' | 'sam' | 'alex'

export const PEOPLE: Record<Person, { name: string; color: string; initial: string }> = {
  you: { name: 'You', color: 'hsl(var(--riso-tomato))', initial: 'Y' },
  sam: { name: 'Sam', color: 'hsl(var(--riso-cobalt))', initial: 'S' },
  alex: { name: 'Alex', color: 'hsl(var(--riso-marigold))', initial: 'A' },
}

/** 1 not excited, 3 neutral, 5 excited, 'seen' already watched, absent = hasn't rated. */
export type Rating = 1 | 3 | 5 | 'seen'

export type PosterStyle = 'sun' | 'stripes' | 'moon' | 'grid' | 'wave' | 'eye' | 'stack' | 'arch'

export interface DemoTitle {
  id: string
  title: string
  year: number
  kind: 'Movie' | 'Series'
  genre: string
  poster: PosterStyle
  /** Background + shape inks, as CSS colours. */
  bg: string
  fg: string
  ratings: Partial<Record<Person, Rating>>
}

const tomato = 'hsl(var(--riso-tomato))'
const marigold = 'hsl(var(--riso-marigold))'
const cobalt = 'hsl(var(--riso-cobalt))'
const ink = 'hsl(var(--ink))'
const paper = 'hsl(var(--canvas))'

export const TITLES: DemoTitle[] = [
  {
    id: 'static',
    title: 'Velvet Static',
    year: 2023,
    kind: 'Series',
    genre: 'Music',
    poster: 'stack',
    bg: cobalt,
    fg: tomato,
    ratings: { you: 5, sam: 'seen', alex: 'seen' },
  },
  {
    id: 'honey',
    title: 'Salt & Honey',
    year: 2025,
    kind: 'Movie',
    genre: 'Romance',
    poster: 'arch',
    bg: marigold,
    fg: tomato,
    ratings: { you: 5, sam: 'seen', alex: 5 },
  },
  {
    id: 'margate',
    title: 'Moon Over Margate',
    year: 2024,
    kind: 'Movie',
    genre: 'Comedy',
    poster: 'moon',
    bg: cobalt,
    fg: marigold,
    ratings: { you: 5, sam: 3, alex: 5 },
  },
  {
    id: 'nightbus',
    title: 'Night Bus',
    year: 2024,
    kind: 'Series',
    genre: 'Mystery',
    poster: 'grid',
    bg: paper,
    fg: ink,
    ratings: { you: 5, sam: 5, alex: 1 },
  },
  {
    id: 'heist',
    title: 'The Quiet Heist',
    year: 2023,
    kind: 'Movie',
    genre: 'Thriller',
    poster: 'stripes',
    bg: ink,
    fg: tomato,
    ratings: { you: 5, sam: 3, alex: 'seen' },
  },
  {
    id: 'kingfisher',
    title: 'Kingfisher',
    year: 2025,
    kind: 'Series',
    genre: 'Drama',
    poster: 'wave',
    bg: marigold,
    fg: cobalt,
    ratings: { you: 3, sam: 5, alex: 5 },
  },
  {
    id: 'planets',
    title: 'Paper Planets',
    year: 2022,
    kind: 'Movie',
    genre: 'Animation',
    poster: 'sun',
    bg: tomato,
    fg: marigold,
    ratings: { you: 5, alex: 1 },
  },
  {
    id: 'harbor',
    title: 'Glass Harbor',
    year: 2021,
    kind: 'Movie',
    genre: 'Sci-fi',
    poster: 'eye',
    bg: ink,
    fg: marigold,
    ratings: { you: 1, sam: 5, alex: 3 },
  },
]

export const titleById = (id: string) => TITLES.find((t) => t.id === id) as DemoTitle

const wants = (r: Rating | undefined): r is 1 | 3 | 5 => typeof r === 'number'

/**
 * The room pick for whoever's on the couch, ranked the way the app ranks.
 * Ties fall to list order, which is arranged so every couch gets its own pick.
 */
export function pickFor(people: Person[]): { title: DemoTitle; interested: Person[] } | null {
  if (people.length === 0) return null
  const scored = TITLES.map((title) => {
    const interested = people.filter((p) => wants(title.ratings[p]))
    const total = interested.reduce((sum, p) => sum + (title.ratings[p] as number), 0)
    return { title, interested, avg: interested.length ? total / interested.length : 0 }
  })
    // Solo picks need you to actually want it; room picks need at least one taker.
    .filter((s) => s.interested.length > 0)
    .filter((s) => people.length > 1 || s.avg >= 3)

  scored.sort((a, b) => b.interested.length - a.interested.length || b.avg - a.avg)
  const best = scored[0]
  return best ? { title: best.title, interested: best.interested } : null
}
