'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface BrandVideoProps {
  /** Wrapper classes; set the aspect ratio here. */
  className?: string
}

/**
 * The looping Looksee animation. Decorative, so it is muted, always playing and
 * hidden from assistive tech — there is no control to press.
 *
 * The clip has no visible edge because its paper is baked to decode as exactly
 * `--canvas`, flat enough that compression noise doesn't mottle it. WebKit
 * ignores both SVG filters and blend modes on accelerated video layers, so
 * correcting it in CSS would only have worked outside Safari. To re-bake after
 * a palette change (levels measured from the source clip's paper):
 *
 *   ffmpeg -i welcome.mp4 -vf "colorlevels=rimax=0.945098:gimax=0.917647:\
 *     bimax=0.847059,colorlevels=romax=<R/255>:gomax=<G/255>:bomax=<B/255>" \
 *     -c:v libx264 -crf 16 -pix_fmt yuv420p -colorspace bt709 -an out.mp4
 *
 * The first pass clips the paper flat to white, the second scales it to the
 * canvas colour. YUV rounding shifts the result a level or two, so measure what
 * the browser actually decodes and set `--canvas` to that.
 *
 * `object-contain` keeps the mark uncropped; the leftover space is the wrapper's
 * matching canvas, so the box stays invisible whatever ratio the caller picks.
 */
export function BrandVideo({ className }: BrandVideoProps) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return

    // Safari blocks autoplay in Low Power Mode and pauses on tab switch, so
    // keep nudging it: on mount, when the tab comes back, and (as a last
    // resort) after the first interaction anywhere on the page.
    const play = () => {
      const attempt = video.play()
      if (attempt) attempt.catch(() => {})
    }

    play()
    document.addEventListener('visibilitychange', play)
    window.addEventListener('pointerdown', play, { once: true })

    return () => {
      document.removeEventListener('visibilitychange', play)
      window.removeEventListener('pointerdown', play)
    }
  }, [])

  return (
    <div className={cn('overflow-hidden bg-canvas', className)}>
      <video
        ref={ref}
        autoPlay
        loop
        muted
        playsInline
        preload='auto'
        disablePictureInPicture
        aria-hidden
        tabIndex={-1}
        className='h-full w-full object-contain object-center'
      >
        <source src='/welcome.mp4' type='video/mp4' />
      </video>
    </div>
  )
}
