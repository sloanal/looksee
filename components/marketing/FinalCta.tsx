import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BrandVideo } from '@/components/BrandVideo'
import { Reveal } from './Reveal'

export function FinalCta() {
  return (
    <section className='px-5 pb-10 pt-10 sm:px-8 sm:pb-14'>
      <Reveal y={40} className='mx-auto max-w-6xl'>
        <div className='relative overflow-hidden rounded-[2rem] bg-canvas px-6 py-14 ring-2 ring-ink sm:px-12 sm:py-20'>
          <div aria-hidden className='halftone halftone-fade absolute -left-10 -top-10 h-72 w-72 rounded-full text-foreground/20' />
          <div aria-hidden className='riso-multiply absolute -right-16 -top-16 hidden h-64 w-64 rounded-full bg-tomato lg:block' />
          <div aria-hidden className='riso-multiply absolute -bottom-24 right-40 h-60 w-60 rounded-full bg-cobalt/90' />
          <div aria-hidden className='riso-multiply absolute -bottom-10 right-[-2rem] h-44 w-44 rounded-full bg-marigold' />

          <div className='relative grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]'>
            <div className='text-center lg:text-left'>
              <h2 className='font-display text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[0.98]'>
                Tonight&apos;s movie is already on{' '}
                <span className='font-accent text-[1.1em]'>someone&apos;s</span> list.
              </h2>
              <p className='mx-auto mt-5 max-w-md text-lg text-muted-foreground lg:mx-0'>
                Let Looksee do the looking. Free to use, and set up in about a minute.
              </p>
              <div className='mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start'>
                <Link
                  href='/auth/signup'
                  className='group inline-flex h-14 items-center gap-2 rounded-full bg-ink px-7 text-base font-semibold text-canvas shadow-pop transition-transform hover:-translate-y-0.5 active:scale-[0.97]'
                >
                  Create your free account
                  <ArrowRight className='h-4 w-4 transition-transform duration-300 group-hover:translate-x-1' aria-hidden />
                </Link>
                <Link
                  href='/auth/signin'
                  className='inline-flex h-14 items-center rounded-full px-6 text-base font-semibold text-foreground underline-offset-4 hover:underline'
                >
                  I already have one
                </Link>
              </div>
            </div>
            <div className='relative mx-auto w-full max-w-[220px] sm:max-w-[320px]'>
              <div className='grid aspect-square place-items-center rounded-full bg-canvas shadow-modal ring-2 ring-ink'>
                <BrandVideo className='aspect-[720/544] w-[78%]' />
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
