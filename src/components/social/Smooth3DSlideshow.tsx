"use client"

import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react"
import { motion } from "framer-motion"
import { Play, Sparkles } from "lucide-react"

interface Slide {
  image?: { src?: string; alt?: string } | null
  title?: string
  id?: string
}

interface Smooth3DSlideshowProps {
  slides?: Slide[]
  cardWidth?: number
  cardHeight?: number
  tilt?: number
  sideTilt?: number
  gap?: number
  opacity?: number
  autoplay?: boolean
  onPlayGame?: (id: string) => void
}

const PERSPECTIVE = 1600
const SCALE_STEP = 0.16
const MAX_VISIBLE = 2
const DEPTH = 240

function cssTransition(t?: { duration?: number; ease?: number[] | string }): { dur: number; ease: string } {
  const dur = t && typeof t.duration === "number" ? t.duration : 0.6
  let ease = "cubic-bezier(0.22, 1, 0.36, 1)"
  const e = t?.ease
  if (Array.isArray(e) && e.length === 4) {
    ease = `cubic-bezier(${e[0]}, ${e[1]}, ${e[2]}, ${e[3]})`
  } else if (typeof e === "string") {
    const map: Record<string, string> = {
      linear: "linear",
      easeIn: "ease-in",
      easeOut: "ease-out",
      easeInOut: "ease-in-out",
    }
    ease = map[e] || "ease"
  }
  return { dur, ease }
}

export default function Smooth3DSlideshow(props: Smooth3DSlideshowProps) {
  const {
    slides = [],
    cardWidth = 400,
    cardHeight = 400,
    tilt = 12,
    sideTilt = 8,
    gap = 8,
    opacity = 60,
    autoplay = true,
    onPlayGame,
  } = props

  const n = slides.length
  const [active, setActive] = useState(0)

  useEffect(() => {
    setActive((a) => Math.max(0, Math.min(n - 1, a)))
  }, [n])

  const moveDur = 0.6
  const lockRef = useRef(false)
  const lock = useCallback(() => {
    lockRef.current = true
    window.setTimeout(() => { lockRef.current = false }, Math.max(50, moveDur * 1000))
  }, [])

  const step = useCallback((dir: number) => {
    if (lockRef.current || n === 0) return
    lock()
    setActive((a) => (((a + dir) % n) + n) % n)
  }, [n, lock])

  const handleCardClick = useCallback((i: number) => {
    if (lockRef.current || n === 0) return
    lock()
    setActive((a) => (i === a ? (a + 1) % n : i))
  }, [n, lock])

  // Autoplay
  const delay = 3
  useEffect(() => {
    if (!autoplay || n < 2) return
    const ms = Math.max(0.3, delay) * 1000
    const id = window.setInterval(() => step(1), ms)
    return () => window.clearInterval(id)
  }, [autoplay, delay, n, step])

  const { dur, ease } = cssTransition()
  const transitionCss = `transform ${dur}s ${ease}, opacity ${dur}s ${ease}`
  const effectiveRadius = Math.min(cardWidth, cardHeight) / 8
  const dim = 1 - Math.max(0, Math.min(100, opacity)) / 100

  if (n === 0) return null;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: cardHeight + 60,
        perspective: `${PERSPECTIVE}px`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "relative",
          width: cardWidth,
          height: cardHeight,
          margin: "0 auto",
          transformStyle: "preserve-3d",
          top: "50%",
          transform: "translateY(-50%)",
        }}
      >
        {slides.map((slide, i) => {
          let rel = i - active
          if (n > 0) {
            if (rel > n / 2) rel -= n
            if (rel < -n / 2) rel += n
          }
          const ax = Math.abs(rel)
          const visible = ax <= MAX_VISIBLE
          const isActive = rel === 0
          const sc = Math.max(0.4, 1 - ax * SCALE_STEP)
          const tx = rel * (gap * 30)
          const tz = -ax * DEPTH
          const ry = -rel * tilt
          const rz = rel * sideTilt
          const src = slide.image?.src || ""

          return (
            <div
              key={slide.id || i}
              onClick={() => handleCardClick(i)}
              onDoubleClick={() => {
                if (isActive && slide.id && onPlayGame) {
                  onPlayGame(slide.id)
                }
              }}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: cardWidth,
                height: cardHeight,
                borderRadius: effectiveRadius,
                overflow: "hidden",
                transformStyle: "preserve-3d",
                transformOrigin: "center center",
                transform: `translate(-50%, -50%) translateX(${tx}px) translateZ(${tz}px) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${sc})`,
                transition: transitionCss,
                opacity: visible ? 1 : 0,
                cursor: isActive ? "pointer" : "pointer",
                pointerEvents: visible ? "auto" : "none",
                background: "linear-gradient(135deg, oklch(0.15 0.05 260), oklch(0.1 0.03 270))",
                border: "1px solid oklch(1 0 0 / 0.08)",
                boxShadow: isActive
                  ? "0 20px 60px -15px oklch(0 0 0 / 0.6), 0 0 0 1px oklch(0.54 0.175 255 / 0.3)"
                  : "0 10px 30px -10px oklch(0 0 0 / 0.4)",
              }}
            >
              {src ? (
                <img
                  src={src}
                  alt={slide.title || ""}
                  draggable={false}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    userSelect: "none",
                  }}
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "oklch(0.6 0.1 260)",
                    fontSize: 14,
                    fontFamily: "monospace",
                  }}
                >
                  Sin portada
                </div>
              )}

              {/* Gradient overlay for readability */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 40%, transparent 60%)",
                  pointerEvents: "none",
                }}
              />

              {/* Title */}
              <div
                style={{
                  position: "absolute",
                  left: 18,
                  right: 18,
                  bottom: 18,
                  pointerEvents: "none",
                }}
              >
                <span
                  style={{
                    color: "#fff",
                    fontSize: 22,
                    fontWeight: 700,
                    lineHeight: "1.2em",
                    letterSpacing: "-0.02em",
                    textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {slide.title}
                </span>
              </div>

              {/* Play button on active card */}
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    pointerEvents: "none",
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: "oklch(1 0 0 / 0.9)",
                      backdropFilter: "blur(8px)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 8px 24px -4px oklch(0 0 0 / 0.5)",
                    }}
                  >
                    <Play size={24} fill="oklch(0.54 0.175 255)" style={{ color: "oklch(0.54 0.175 255)", marginLeft: 3 }} />
                  </div>
                </div>
              )}

              {/* Dim overlay for inactive cards */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "#000",
                  opacity: isActive ? 0 : dim,
                  transition: `opacity ${dur}s ${ease}`,
                  pointerEvents: "none",
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Bottom navigation dots */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 6,
        }}
      >
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => { lock(); setActive(i) }}
            style={{
              width: i === active ? 24 : 6,
              height: 6,
              borderRadius: 3,
              border: "none",
              background: i === active
                ? "oklch(0.54 0.175 255)"
                : "oklch(1 0 0 / 0.2)",
              cursor: "pointer",
              transition: "all 0.3s ease",
              padding: 0,
            }}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
