'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BrandLockup } from '@/components/brand-lockup'

type LookbookFrame = { src: string; alt: string }

type LookbookSlide = {
  id: string
  title: string
  purpose: string
  copy: string
  images: LookbookFrame[]
  origin: 'workspace' | 'registry'
  status: string
  category?: string
  garmentId?: string
  colorway?: string
}

type LookbookPayload = {
  collection?: { name?: string; revision?: string }
  slides?: LookbookSlide[]
}

function pulse() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  navigator.vibrate?.(12)
}

export function CollectionPage() {
  const railRef = useRef<HTMLDivElement>(null)
  const indexRef = useRef(0)
  const wheelLock = useRef(0)
  const [slides, setSlides] = useState<LookbookSlide[]>([])
  const [index, setIndex] = useState(0)
  const [frames, setFrames] = useState<Record<string, number>>({})
  const [ready, setReady] = useState(false)
  const collectionName = 'MM Collection'

  useEffect(() => {
    let cancel = false
    fetch('/v1/collection/lookbook')
      .then((response) => response.ok ? response.json() : { slides: [] })
      .then((payload: LookbookPayload) => {
        if (cancel || !Array.isArray(payload.slides)) return
        setSlides(payload.slides.filter((slide) => slide && Array.isArray(slide.images) && slide.images.length > 0))
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancel) setReady(true)
      })
    return () => { cancel = true }
  }, [])

  useEffect(() => {
    if (!slides.length) return
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''))
    if (!hash) return
    const found = slides.findIndex((slide) => slide.id === hash || slide.garmentId === hash)
    const rail = railRef.current
    if (found < 0 || !rail) return
    rail.scrollTo({ left: found * rail.clientWidth, behavior: 'auto' })
    indexRef.current = found
    setIndex(found)
  }, [slides])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const onScroll = () => {
      const width = rail.clientWidth || 1
      const next = Math.min(slides.length - 1, Math.max(0, Math.round(rail.scrollLeft / width)))
      if (next === indexRef.current) return
      indexRef.current = next
      setIndex(next)
      pulse()
    }
    const onWheel = (event: WheelEvent) => {
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      if (Math.abs(delta) < 8) return
      event.preventDefault()
      const now = Date.now()
      if (now - wheelLock.current < 480) return
      wheelLock.current = now
      const count = slides.length
      if (!count) return
      const wrapped = (indexRef.current + (delta > 0 ? 1 : -1) + count) % count
      rail.scrollTo({ left: wrapped * rail.clientWidth, behavior: 'smooth' })
    }
    rail.addEventListener('scroll', onScroll, { passive: true })
    rail.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      rail.removeEventListener('scroll', onScroll)
      rail.removeEventListener('wheel', onWheel)
    }
  }, [slides.length])

  const go = useCallback((next: number) => {
    const rail = railRef.current
    const count = slides.length
    if (!rail || !count) return
    const wrapped = (next + count) % count
    rail.scrollTo({ left: wrapped * rail.clientWidth, behavior: 'smooth' })
  }, [slides.length])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return
      if (event.key === 'ArrowRight') go(indexRef.current + 1)
      if (event.key === 'ArrowLeft') go(indexRef.current - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const current = slides[index]
  const frame = current ? frames[current.id] ?? 0 : 0
  const image = current?.images[Math.min(frame, current.images.length - 1)]
  const position = slides.length ? `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}` : '00 / 00'

  return (
    <div className="fv-home">
      <header className="topbar">
        <nav className="nav wrap" aria-label="Main navigation">
          <BrandLockup markCurrent />
          <div className="nav-links">
            <a href="/#services">Services</a>
            <a href="/collection" aria-current="page">Collection</a>
            <a href="/ai-chat">AI Chat</a>
          </div>
          <a className="profile" href="/profile">Profile</a>
        </nav>
      </header>
      <main className="section collection">
        <div className="wrap">
          <div className="collection-head">
            <div>
              <p className="eyebrow">Lookbook · Rev A</p>
              <h1>{collectionName}</h1>
            </div>
            <p>Swipe sideways through the collection boards. Garments uploaded from the admin registry are added to the end of this sequence. Artwork stays a concept reference until the registry marks it otherwise.</p>
          </div>
          <div className="lookbook-controls">
            <button type="button" onClick={() => go(index - 1)} disabled={!slides.length}>← Previous</button>
            <button type="button" onClick={() => go(index + 1)} disabled={!slides.length}>Next →</button>
            <p aria-live="polite">{current ? `${position} · ${current.title}` : ready ? 'No lookbook pages yet' : 'Loading lookbook'}</p>
          </div>
          {slides.length ? (
            <>
              <div className="lookbook-rail" ref={railRef} tabIndex={0} aria-label="MM Collection lookbook">
                {slides.map((slide, slideIndex) => {
                  const shown = slide.images[slide.id === current?.id ? Math.min(frame, slide.images.length - 1) : 0]
                  return (
                    <article className="lookbook-slide" key={slide.id} aria-hidden={slideIndex !== index}>
                      <img src={shown.src} alt={slideIndex === index ? shown.alt : ''} />
                    </article>
                  )
                })}
              </div>
              {current && image ? (
                <div className="lookbook-meta">
                  <div>
                    <p className="lookbook-kicker">{current.origin === 'registry' ? 'Garment registry' : `Spread ${position.split(' / ')[0]}`} · {current.status}</p>
                    <h2>{current.title}</h2>
                    <p>{current.copy}</p>
                    <p className="lookbook-note">Concept reference · source image shown intact{current.garmentId ? ` · ${current.garmentId}` : ''}{current.colorway ? ` · ${current.colorway}` : ''}</p>
                  </div>
                  {current.images.length > 1 ? (
                    <div className="lookbook-frames" aria-label={`${current.title} views`}>
                      {current.images.map((item, frameIndex) => (
                        <button
                          type="button"
                          key={item.src}
                          aria-current={frameIndex === frame ? 'true' : undefined}
                          aria-label={`Show view ${frameIndex + 1}`}
                          onClick={() => setFrames((state) => ({ ...state, [current.id]: frameIndex }))}
                        >
                          <img src={item.src} alt="" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : <p className="look-empty">{ready ? 'The lookbook workspace did not return any pages.' : 'Loading lookbook'}</p>}
        </div>
      </main>
    </div>
  )
}
