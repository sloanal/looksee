'use client'

import { MotionConfig } from 'framer-motion'
import { FeatureGrid } from './FeatureGrid'
import { FinalCta } from './FinalCta'
import { Hero } from './Hero'
import { InstallSection } from './InstallSection'
import { HowItWorks } from './HowItWorks'
import { Marquee } from './Marquee'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'
import { TroubleSection } from './TroubleSection'
import { VennSection } from './VennSection'

export function LandingPage() {
  return (
    <MotionConfig reducedMotion='user'>
      <div className='site-scroll paper-grain min-h-[100dvh] overflow-x-clip bg-canvas text-foreground'>
        <a
          href='#main'
          className='sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-canvas'
        >
          Skip to content
        </a>
        <SiteNav />
        <main id='main'>
          <Hero />
          <Marquee />
          <VennSection />
          <HowItWorks />
          <TroubleSection />
          <FeatureGrid />
          <FinalCta />
          <InstallSection />
        </main>
        <SiteFooter />
      </div>
    </MotionConfig>
  )
}
