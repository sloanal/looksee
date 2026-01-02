import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local if it exists
config({ path: resolve(process.cwd(), '.env.local') })
// Also try .env as fallback
config({ path: resolve(process.cwd(), '.env') })

const prisma = new PrismaClient()

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

interface MediaItem {
  title: string
  type: 'MOVIE' | 'SHOW' | 'DOCUMENTARY'
  category: string
}

// Parse the user's list into structured data
const mediaList: MediaItem[] = [
  // Thriller/Horror
  { title: 'Marathon Man', type: 'MOVIE', category: 'Thriller/Horror' },
  { title: 'The Ring', type: 'MOVIE', category: 'Thriller/Horror' },
  { title: 'House of the Devil', type: 'MOVIE', category: 'Thriller/Horror' },
  { title: 'The Substance', type: 'MOVIE', category: 'Thriller/Horror' },
  { title: 'Suspiria', type: 'MOVIE', category: 'Thriller/Horror' }, // Note: user wrote "Susperia" but corrected to "Suspiria"
  { title: 'Cloverfield', type: 'MOVIE', category: 'Thriller/Horror' },
  { title: 'American Psycho', type: 'MOVIE', category: 'Thriller/Horror' },
  { title: 'The Sixth Sense', type: 'MOVIE', category: 'Thriller/Horror' },
  { title: 'Antebellum', type: 'MOVIE', category: 'Thriller/Horror' },
  { title: 'Basic Instinct', type: 'MOVIE', category: 'Thriller/Horror' },
  { title: 'Blue Caprice', type: 'MOVIE', category: 'Thriller/Horror' },
  { title: 'The Wolf Man', type: 'MOVIE', category: 'Thriller/Horror' },
  { title: 'Heathers', type: 'MOVIE', category: 'Thriller/Horror' },
  
  // Drama
  { title: 'Another Round', type: 'MOVIE', category: 'Drama' },
  { title: 'Monster\'s Ball', type: 'MOVIE', category: 'Drama' },
  { title: 'Melancholia', type: 'MOVIE', category: 'Drama' },
  { title: 'The Killing Fields', type: 'MOVIE', category: 'Drama' },
  { title: 'CODA', type: 'MOVIE', category: 'Drama' },
  { title: 'Almost Famous', type: 'MOVIE', category: 'Drama' },
  { title: 'Nine Days', type: 'MOVIE', category: 'Drama' },
  { title: 'City of Gold', type: 'MOVIE', category: 'Drama' },
  { title: 'Radioactive', type: 'MOVIE', category: 'Drama' },
  { title: 'Uncle Frank', type: 'MOVIE', category: 'Drama' },
  { title: '42', type: 'MOVIE', category: 'Drama' },
  { title: 'Just Mercy', type: 'MOVIE', category: 'Drama' },
  { title: 'Da 5 Bloods', type: 'MOVIE', category: 'Drama' },
  { title: 'A Beautiful Mind', type: 'MOVIE', category: 'Drama' },
  { title: 'The Current War', type: 'MOVIE', category: 'Drama' },
  { title: 'The Piano', type: 'MOVIE', category: 'Drama' },
  { title: 'True Grit', type: 'MOVIE', category: 'Drama' },
  { title: 'Jackie', type: 'MOVIE', category: 'Drama' },
  { title: 'Elle', type: 'MOVIE', category: 'Drama' },
  { title: 'Boyhood', type: 'MOVIE', category: 'Drama' },
  { title: 'The Man from Earth', type: 'MOVIE', category: 'Drama' },
  { title: 'Rebel Without a Cause', type: 'MOVIE', category: 'Drama' },
  { title: 'Sometimes a Great Notion', type: 'MOVIE', category: 'Drama' },
  { title: 'The Spectacular Now', type: 'MOVIE', category: 'Drama' },
  { title: 'Dangerous Minds', type: 'MOVIE', category: 'Drama' },
  { title: 'Field of Dreams', type: 'MOVIE', category: 'Drama' },
  { title: 'The Maltese Falcon', type: 'MOVIE', category: 'Drama' },
  { title: 'The Postman Always Rings Twice', type: 'MOVIE', category: 'Drama' },
  { title: 'Moon', type: 'MOVIE', category: 'Drama' },
  { title: 'Mudbound', type: 'MOVIE', category: 'Drama' },
  { title: 'A River Runs Through It', type: 'MOVIE', category: 'Drama' },
  { title: 'Amistad', type: 'MOVIE', category: 'Drama' },
  { title: 'The Theory of Everything', type: 'MOVIE', category: 'Drama' },
  { title: 'Man on the Moon', type: 'MOVIE', category: 'Drama' },
  { title: 'City of God', type: 'MOVIE', category: 'Drama' },
  { title: 'Girlhood', type: 'MOVIE', category: 'Drama' },
  { title: 'Sophie\'s Choice', type: 'MOVIE', category: 'Drama' },
  { title: 'Middle of Nowhere', type: 'MOVIE', category: 'Drama' },
  { title: 'Whale Rider', type: 'MOVIE', category: 'Drama' },
  { title: 'The Godfather', type: 'MOVIE', category: 'Drama' },
  { title: 'The Shawshank Redemption', type: 'MOVIE', category: 'Drama' },
  { title: 'Goodfellas', type: 'MOVIE', category: 'Drama' },
  { title: '45 Years', type: 'MOVIE', category: 'Drama' },
  { title: 'Milk', type: 'MOVIE', category: 'Drama' },
  { title: 'Meek\'s Cutoff', type: 'MOVIE', category: 'Drama' },
  { title: 'The Last of the Mohicans', type: 'MOVIE', category: 'Drama' },
  { title: 'Up in the Air', type: 'MOVIE', category: 'Drama' },
  { title: 'To Kill a Mockingbird', type: 'MOVIE', category: 'Drama' },
  { title: 'Schindler\'s List', type: 'MOVIE', category: 'Drama' },
  { title: 'Boogie Nights', type: 'MOVIE', category: 'Drama' },
  { title: 'Daughters of the Dust', type: 'MOVIE', category: 'Drama' },
  { title: 'Frances Ha', type: 'MOVIE', category: 'Drama' },
  { title: 'Lady Bird', type: 'MOVIE', category: 'Drama' },
  { title: 'Carol', type: 'MOVIE', category: 'Drama' },
  { title: 'Y Tu Mamá También', type: 'MOVIE', category: 'Drama' },
  { title: 'Contact', type: 'MOVIE', category: 'Drama' },
  { title: 'American Graffiti', type: 'MOVIE', category: 'Drama' },
  { title: 'Dazed and Confused', type: 'MOVIE', category: 'Drama' },
  { title: 'Martha Marcy May Marlene', type: 'MOVIE', category: 'Drama' },
  { title: 'The Age of Innocence', type: 'MOVIE', category: 'Drama' },
  { title: 'Malice', type: 'MOVIE', category: 'Drama' },
  
  // Comedy
  { title: 'The Spanish Apartment', type: 'MOVIE', category: 'Comedy' },
  { title: 'Bio-Dome', type: 'MOVIE', category: 'Comedy' },
  { title: 'Showgirls', type: 'MOVIE', category: 'Comedy' },
  { title: 'Saturday Night Fever', type: 'MOVIE', category: 'Comedy' },
  { title: '8 Mile', type: 'MOVIE', category: 'Comedy' },
  { title: 'Fully Realized Humans', type: 'MOVIE', category: 'Comedy' },
  { title: 'Shaun of the Dead', type: 'MOVIE', category: 'Comedy' },
  { title: 'Hot Fuzz', type: 'MOVIE', category: 'Comedy' },
  { title: 'In a World...', type: 'MOVIE', category: 'Comedy' },
  { title: 'Charade', type: 'MOVIE', category: 'Comedy' },
  { title: 'Fast Times at Ridgemont High', type: 'MOVIE', category: 'Comedy' },
  { title: 'Weekend at Bernie\'s', type: 'MOVIE', category: 'Comedy' },
  { title: 'Booksmart', type: 'MOVIE', category: 'Comedy' },
  { title: 'The Cutting Edge', type: 'MOVIE', category: 'Comedy' },
  { title: 'Ghostbusters', type: 'MOVIE', category: 'Comedy' },
  { title: 'The Big Lebowski', type: 'MOVIE', category: 'Comedy' },
  { title: 'Rushmore', type: 'MOVIE', category: 'Comedy' },
  { title: 'The Royal Tenenbaums', type: 'MOVIE', category: 'Comedy' },
  { title: 'City Slickers', type: 'MOVIE', category: 'Comedy' },
  { title: 'Wayne\'s World', type: 'MOVIE', category: 'Comedy' },
  
  // Sci-Fi/Action
  { title: 'Titane', type: 'MOVIE', category: 'Sci-Fi/Action' },
  { title: 'Starship Troopers', type: 'MOVIE', category: 'Sci-Fi/Action' },
  { title: 'Total Recall', type: 'MOVIE', category: 'Sci-Fi/Action' },
  { title: 'RoboCop', type: 'MOVIE', category: 'Sci-Fi/Action' },
  { title: 'The Matrix', type: 'MOVIE', category: 'Sci-Fi/Action' },
  { title: 'Oblivion', type: 'MOVIE', category: 'Sci-Fi/Action' },
  { title: '2001: A Space Odyssey', type: 'MOVIE', category: 'Sci-Fi/Action' },
  { title: 'The Purge', type: 'MOVIE', category: 'Sci-Fi/Action' },
  { title: 'Blade Runner', type: 'MOVIE', category: 'Sci-Fi/Action' },
  
  // Animation/Family
  { title: 'WALL-E', type: 'MOVIE', category: 'Animation/Family' },
  { title: 'Pixar Short Films', type: 'MOVIE', category: 'Animation/Family' },
  { title: 'The Good Dinosaur', type: 'MOVIE', category: 'Animation/Family' },
  { title: 'Ratatouille', type: 'MOVIE', category: 'Animation/Family' },
  { title: 'Toy Story', type: 'MOVIE', category: 'Animation/Family' },
  { title: 'The Karate Kid', type: 'MOVIE', category: 'Animation/Family' },
  
  // Musical/Music-Focused
  { title: 'All That Jazz', type: 'MOVIE', category: 'Musical/Music-Focused' },
  { title: 'Amadeus', type: 'MOVIE', category: 'Musical/Music-Focused' },
  
  // Crime/Heist
  { title: 'Ocean\'s Eleven', type: 'MOVIE', category: 'Crime/Heist' },
  { title: 'The Block', type: 'MOVIE', category: 'Crime/Heist' },
  
  // Horror-Comedy
  { title: 'The Lost Boys', type: 'MOVIE', category: 'Horror-Comedy' },
  
  // TV Shows - Drama
  { title: 'Normal People', type: 'SHOW', category: 'Drama' },
  { title: 'Northern Exposure', type: 'SHOW', category: 'Drama' },
  { title: 'Six Feet Under', type: 'SHOW', category: 'Drama' },
  { title: 'The Leftovers', type: 'SHOW', category: 'Drama' },
  { title: 'Fortitude', type: 'SHOW', category: 'Drama' },
  { title: 'Band of Brothers', type: 'SHOW', category: 'Drama' },
  { title: 'Nine Perfect Strangers', type: 'SHOW', category: 'Drama' },
  
  // TV Shows - Comedy
  { title: 'Chewing Gum', type: 'SHOW', category: 'Comedy' },
  { title: 'Ted Lasso', type: 'SHOW', category: 'Comedy' },
  { title: 'Detroiters', type: 'SHOW', category: 'Comedy' },
  { title: 'Catastrophe', type: 'SHOW', category: 'Comedy' },
  { title: 'Nurse Jackie', type: 'SHOW', category: 'Comedy' },
  { title: 'Lilyhammer', type: 'SHOW', category: 'Comedy' },
  { title: 'What We Do in the Shadows', type: 'SHOW', category: 'Comedy' },
  { title: 'Chappelle\'s Show', type: 'SHOW', category: 'Comedy' },
  { title: 'Treehouse Masters', type: 'SHOW', category: 'Comedy' },
  
  // Documentaries - Nature/Wildlife
  { title: 'Extreme Lives: Raptors - A Fistful of Daggers', type: 'DOCUMENTARY', category: 'Nature/Wildlife' },
  { title: 'Dissecting Giants', type: 'DOCUMENTARY', category: 'Nature/Wildlife' },
  { title: 'Ocean Giants', type: 'DOCUMENTARY', category: 'Nature/Wildlife' },
  { title: 'Bird of Prey', type: 'DOCUMENTARY', category: 'Nature/Wildlife' },
  
  // Documentaries - Music
  { title: 'Music Box', type: 'DOCUMENTARY', category: 'Music' },
  { title: 'Laurel Canyon', type: 'DOCUMENTARY', category: 'Music' },
  { title: 'The Wrecking Crew', type: 'DOCUMENTARY', category: 'Music' },
  { title: 'Brian Wilson: Long Promised Road', type: 'DOCUMENTARY', category: 'Music' },
  
  // Documentaries - Historical
  { title: 'The Holocaust', type: 'DOCUMENTARY', category: 'Historical' },
  { title: 'Capital in the Twenty-First Century', type: 'DOCUMENTARY', category: 'Historical' },
  { title: 'A Night at the Garden', type: 'DOCUMENTARY', category: 'Historical' },
  { title: 'Paris to Pittsburgh', type: 'DOCUMENTARY', category: 'Historical' },
  { title: '13th', type: 'DOCUMENTARY', category: 'Historical' },
  
  // Documentaries - Biography/Profile
  { title: 'Flaming Hot', type: 'DOCUMENTARY', category: 'Biography/Profile' },
  { title: 'The Weight of Gold', type: 'DOCUMENTARY', category: 'Biography/Profile' },
  { title: 'Jiro Dreams of Sushi', type: 'DOCUMENTARY', category: 'Biography/Profile' },
  { title: 'Making Waves: The Art of Cinematic Sound', type: 'DOCUMENTARY', category: 'Biography/Profile' },
  { title: 'The Inn at Little Washington', type: 'DOCUMENTARY', category: 'Biography/Profile' },
  { title: 'Robert Jones, NOLA', type: 'DOCUMENTARY', category: 'Biography/Profile' },
  
  // Documentaries - Sports/Subculture
  { title: 'Momentum Generation', type: 'DOCUMENTARY', category: 'Sports/Subculture' },
  { title: 'Fyre: The Greatest Party That Never Happened', type: 'DOCUMENTARY', category: 'Sports/Subculture' },
  { title: 'Jimmy Johns: Dig Deep', type: 'DOCUMENTARY', category: 'Sports/Subculture' },
  
  // Documentaries - Technology/Society
  { title: 'Ascension', type: 'DOCUMENTARY', category: 'Technology/Society' },
  { title: 'DMT: The Spirit Molecule', type: 'DOCUMENTARY', category: 'Technology/Society' },
  { title: 'American Genius', type: 'DOCUMENTARY', category: 'Technology/Society' },
  
  // Documentaries - True Crime/Investigative
  { title: 'The Vow', type: 'DOCUMENTARY', category: 'True Crime/Investigative' },
  { title: 'Seduced: Inside the NXIVM Cult', type: 'DOCUMENTARY', category: 'True Crime/Investigative' },
  { title: 'The Innocence Files', type: 'DOCUMENTARY', category: 'True Crime/Investigative' },
  { title: 'I Care a Lot', type: 'DOCUMENTARY', category: 'True Crime/Investigative' },
  { title: 'Black Memorabilia', type: 'DOCUMENTARY', category: 'True Crime/Investigative' },
]

async function searchTMDB(title: string, type: 'MOVIE' | 'SHOW' | 'DOCUMENTARY'): Promise<any> {
  if (!TMDB_API_KEY) {
    return null
  }

  try {
    const searchType = type === 'SHOW' ? 'tv' : 'movie'
    const response = await fetch(
      `${TMDB_BASE_URL}/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&page=1`
    )
    const data = await response.json()
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0]
      return {
        id: result.id,
        title: searchType === 'movie' ? result.title : result.name,
        posterPath: result.poster_path,
        overview: result.overview,
      }
    }
  } catch (error) {
    console.error(`Error searching TMDB for ${title}:`, error)
  }
  
  return null
}

async function getTMDBDetails(id: number, type: 'MOVIE' | 'SHOW'): Promise<any> {
  if (!TMDB_API_KEY) {
    return null
  }

  try {
    const endpoint = type === 'MOVIE' ? 'movie' : 'tv'
    const response = await fetch(
      `${TMDB_BASE_URL}/${endpoint}/${id}?api_key=${TMDB_API_KEY}`
    )
    const data = await response.json()
    
    if (data.status_code || data.status_message) {
      return null
    }

    const genres = data.genres?.map((g: any) => g.name) || []
    const runtime = type === 'MOVIE' ? data.runtime : data.episode_run_time?.[0] || null
    const rating = data.vote_average || null
    const releaseDate = type === 'MOVIE' ? data.release_date : data.first_air_date

    return {
      genres,
      runtimeMinutes: runtime,
      rating,
      releaseDate: releaseDate || null,
      posterUrl: data.poster_path ? `${TMDB_IMAGE_BASE}${data.poster_path}` : null,
      description: data.overview,
    }
  } catch (error) {
    console.error(`Error fetching TMDB details for ${id}:`, error)
  }
  
  return null
}

async function main() {
  const roomId = process.env.ROOM_ID
  const userId = process.env.USER_ID
  const userEmail = process.env.USER_EMAIL

  let finalUserId = userId
  let finalRoomId = roomId

  // If userEmail is provided, find user by email
  if (userEmail && !finalUserId) {
    const user = await prisma.user.findUnique({
      where: { email: userEmail.toLowerCase().trim() },
    })
    if (!user) {
      console.error(`User with email ${userEmail} not found`)
      process.exit(1)
    }
    finalUserId = user.id
    console.log(`Found user: ${user.name} (${user.email})`)
  }

  if (!finalUserId) {
    console.error('Please provide USER_ID or USER_EMAIL as environment variable')
    console.error('Example: USER_EMAIL=your@email.com npm run import:production')
    console.error('Or: USER_ID=xxx ROOM_ID=xxx npm run import:production')
    process.exit(1)
  }

  // If roomId not provided, get the most recent room for the user
  if (!finalRoomId) {
    const membership = await prisma.roomMembership.findFirst({
      where: { userId: finalUserId },
      include: {
        room: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!membership) {
      console.error('No rooms found for this user')
      process.exit(1)
    }

    finalRoomId = membership.room.id
    console.log(`Using most recent room: "${membership.room.name}" (${finalRoomId})`)
  }

  // Verify room exists and user is a member
  const membership = await prisma.roomMembership.findUnique({
    where: {
      userId_roomId: {
        userId: finalUserId,
        roomId: finalRoomId,
      },
    },
    include: {
      room: true,
    },
  })

  if (!membership) {
    console.error('Room not found or user is not a member of this room')
    process.exit(1)
  }

  console.log(`\n🚀 Importing media into production database`)
  console.log(`Room: "${membership.room.name}"`)
  console.log(`Total items to import: ${mediaList.length}\n`)

  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (let i = 0; i < mediaList.length; i++) {
    const item = mediaList[i]
    console.log(`[${i + 1}/${mediaList.length}] Processing: ${item.title} (${item.type})`)

    try {
      // Check if item already exists in room (by tmdbId if we have it, or by title)
      let existing = null
      
      // First try to get TMDB data to check by tmdbId
      let tmdbData = null
      let tmdbId: string | null = null
      let posterUrl: string | null = null
      let description: string | null = null
      let genres: string[] = [item.category]
      let runtimeMinutes: number | null = null
      let rating: number | null = null
      let releaseDate: string | null = null

      // Try to find in TMDB (skip for documentaries as they're less likely to be there)
      if (item.type !== 'DOCUMENTARY' && TMDB_API_KEY) {
        const searchResult = await searchTMDB(item.title, item.type)
        if (searchResult) {
          tmdbId = searchResult.id.toString()
          
          // Check if item with this tmdbId already exists
          existing = await prisma.mediaItem.findFirst({
            where: {
              roomId: finalRoomId,
              tmdbId: tmdbId,
            },
          })

          if (!existing) {
            // Get full details from TMDB
            const details = await getTMDBDetails(searchResult.id, item.type === 'SHOW' ? 'SHOW' : 'MOVIE')
            if (details) {
              posterUrl = details.posterUrl
              description = details.description
              genres = details.genres.length > 0 ? details.genres : [item.category]
              runtimeMinutes = details.runtimeMinutes
              rating = details.rating
              releaseDate = details.releaseDate
            } else {
              posterUrl = searchResult.posterPath ? `${TMDB_IMAGE_BASE}${searchResult.posterPath}` : null
              description = searchResult.overview
            }
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 250))
      }

      // If not found by tmdbId, check by title (case-insensitive)
      if (!existing) {
        existing = await prisma.mediaItem.findFirst({
          where: {
            roomId: finalRoomId,
            title: {
              equals: item.title,
              mode: 'insensitive',
            },
          },
        })
      }

      if (existing) {
        console.log(`  ⏭️  Already exists, skipping`)
        skipCount++
        continue
      }

      // Create media item
      const mediaItem = await prisma.mediaItem.create({
        data: {
          roomId: finalRoomId,
          title: item.title,
          type: item.type === 'DOCUMENTARY' ? 'MOVIE' : item.type, // Documentaries stored as MOVIE
          tmdbId,
          sourceType: tmdbId ? 'TMDB' : 'MANUAL',
          posterUrl,
          description,
          genres: JSON.stringify(genres),
          runtimeMinutes,
          rating,
          releaseDate,
          createdByUserId: finalUserId,
        },
      })

      // Create default preference (NOT_SEEN_WANT with excitement 3)
      await prisma.userMediaPreference.create({
        data: {
          userId: finalUserId,
          mediaItemId: mediaItem.id,
          status: 'NOT_SEEN_WANT',
          excitement: 3,
        },
      })

      console.log(`  ✅ Created${tmdbId ? ' (with TMDB data)' : ' (manual entry)'}`)
      successCount++
    } catch (error) {
      console.error(`  ❌ Error:`, error)
      errorCount++
    }
  }

  console.log('\n=== Summary ===')
  console.log(`✅ Successfully created: ${successCount}`)
  console.log(`⏭️  Skipped (already exists): ${skipCount}`)
  console.log(`❌ Errors: ${errorCount}`)
  console.log(`Total processed: ${mediaList.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

