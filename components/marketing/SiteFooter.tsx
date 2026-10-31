import Link from 'next/link'
import { Logo } from './Logo'

export function SiteFooter() {
  return (
    <footer className='border-t border-foreground/10 px-5 py-10 sm:px-8'>
      <div className='mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <Logo />
          <p className='mt-2 text-sm text-muted-foreground'>Spend less time deciding what to watch.</p>
        </div>
        <nav aria-label='Footer' className='flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium'>
          <a href='#how' className='text-muted-foreground hover:text-foreground'>How it works</a>
          <a href='#features' className='text-muted-foreground hover:text-foreground'>Features</a>
          <Link href='/auth/signin' className='text-muted-foreground hover:text-foreground'>Log in</Link>
          <Link href='/auth/signup' className='text-muted-foreground hover:text-foreground'>Sign up</Link>
        </nav>
      </div>
      <p className='mx-auto mt-8 max-w-6xl text-xs text-muted-foreground'>
        © {new Date().getFullYear()} Looksee. Movie and show data from TMDB. This product uses the
        TMDB API but is not endorsed or certified by TMDB. Titles shown on this page are made up.
      </p>
    </footer>
  )
}
