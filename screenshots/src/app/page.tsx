"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toPng } from "html-to-image";

// ─── Canvas dimensions ───────────────────────────────────────────────────────
const W = 1320;
const H = 2868;

// ─── Brand tokens ────────────────────────────────────────────────────────────
const LIME = "#B4F34D";
const BLACK = "#0B0B0B";
const DARK = "#111111";
const CARD = "#181818";
const BORDER = "rgba(180,243,77,0.18)";
const MUTED = "rgba(255,255,255,0.45)";

// ─── iPhone mockup pre-measured values ───────────────────────────────────────
const MK_W = 1022;
const MK_H = 2082;
const SC_L = (52 / MK_W) * 100;
const SC_T = (46 / MK_H) * 100;
const SC_W = (918 / MK_W) * 100;
const SC_H = (1990 / MK_H) * 100;
const SC_RX = (126 / 918) * 100;
const SC_RY = (126 / 1990) * 100;

// ─── Export sizes ─────────────────────────────────────────────────────────────
const SIZES = [
  { label: '6.9"', w: 1320, h: 2868 },
  { label: '6.5"', w: 1284, h: 2778 },
  { label: '6.3"', w: 1206, h: 2622 },
  { label: '6.1"', w: 1125, h: 2436 },
];

// ─── Phone component ─────────────────────────────────────────────────────────
function Phone({
  children,
  style,
  className = "",
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={`relative ${className}`}
      style={{ aspectRatio: `${MK_W}/${MK_H}`, ...style }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mockup.png"
        alt=""
        style={{ display: "block", width: "100%", height: "100%" }}
        draggable={false}
      />
      <div
        style={{
          position: "absolute",
          left: `${SC_L}%`,
          top: `${SC_T}%`,
          width: `${SC_W}%`,
          height: `${SC_H}%`,
          borderRadius: `${SC_RX}% / ${SC_RY}%`,
          overflow: "hidden",
          zIndex: 10,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Caption component ────────────────────────────────────────────────────────
function Caption({
  label,
  headline,
  sub,
  canvasW = W,
  light = false,
  center = false,
}: {
  label: string;
  headline: React.ReactNode;
  sub?: string;
  canvasW?: number;
  light?: boolean;
  center?: boolean;
}) {
  const labelSize = canvasW * 0.028;
  const headlineSize = canvasW * 0.092;
  const subSize = canvasW * 0.036;
  return (
    <div style={{ textAlign: center ? "center" : "left" }}>
      <div
        style={{
          fontSize: labelSize,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: LIME,
          marginBottom: canvasW * 0.018,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: headlineSize,
          fontWeight: 800,
          lineHeight: 1.0,
          color: light ? BLACK : "#FFFFFF",
          marginBottom: sub ? canvasW * 0.022 : 0,
        }}
      >
        {headline}
      </div>
      {sub && (
        <div
          style={{
            fontSize: subSize,
            fontWeight: 400,
            color: light ? "rgba(0,0,0,0.55)" : MUTED,
            lineHeight: 1.4,
            marginTop: canvasW * 0.016,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Glow blob ────────────────────────────────────────────────────────────────
function LimeGlow({
  size,
  opacity = 0.22,
  style,
}: {
  size: number;
  opacity?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        background: LIME,
        filter: `blur(${size * 0.38}px)`,
        opacity,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

// ─── Fake app screen components ──────────────────────────────────────────────

function ScoreScreen() {
  const metrics = [
    { label: "Jawline", score: 71 },
    { label: "Cheekbones", score: 58 },
    { label: "Symmetry", score: 63 },
    { label: "Skin Quality", score: 80 },
    { label: "Eye Area", score: 55 },
    { label: "Nose", score: 68 },
    { label: "Definition", score: 62 },
  ];
  const overall = 65;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: BLACK,
        display: "flex",
        flexDirection: "column",
        padding: "8% 6% 6%",
        boxSizing: "border-box",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Status bar */}
      <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.5)", fontSize: "3.5%", marginBottom: "6%" }}>
        <span>9:41</span><span>●●●</span>
      </div>
      <div style={{ color: LIME, fontSize: "3.2%", fontWeight: 600, letterSpacing: "0.1em", marginBottom: "2%" }}>YOUR SCORE</div>
      {/* Big score */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: "2%", marginBottom: "1%" }}>
        <span style={{ fontSize: "22%", fontWeight: 900, color: "#fff", lineHeight: 1 }}>{overall}</span>
        <span style={{ fontSize: "5%", color: LIME, fontWeight: 700, marginBottom: "4%" }}>/100</span>
      </div>
      <div style={{ fontSize: "3.8%", fontWeight: 600, color: LIME, marginBottom: "6%" }}>Chad Lite</div>
      {/* Metrics */}
      {metrics.map((m) => (
        <div key={m.label} style={{ marginBottom: "2.8%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.7)", fontSize: "3.2%", marginBottom: "1%" }}>
            <span>{m.label}</span><span style={{ color: m.score >= 70 ? LIME : "rgba(255,255,255,0.7)" }}>{m.score}</span>
          </div>
          <div style={{ height: "1.4%", background: "rgba(255,255,255,0.08)", borderRadius: 99 }}>
            <div style={{ width: `${m.score}%`, height: "100%", background: LIME, borderRadius: 99, opacity: 0.9 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalysisScreen() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: BLACK,
        display: "flex",
        flexDirection: "column",
        padding: "8% 6% 5%",
        boxSizing: "border-box",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "3.2%", marginBottom: "2%" }}>9:41</div>
      <div style={{ color: LIME, fontSize: "3.2%", fontWeight: 600, letterSpacing: "0.1em", marginBottom: "4%" }}>ADVANCED ANALYSIS</div>
      {/* Jawline card */}
      {[
        { title: "JAWLINE", sub: "Lower face definition", metrics: [{ k: "Development", v: 64, note: "Moderate mandibular definition" }, { k: "Gonial Angle", v: 71, note: "Clean posterior angle" }, { k: "Chin Projection", v: 68, note: "Slight recession present" }] },
        { title: "CHEEKBONES", sub: "Midface structure", metrics: [{ k: "Width", v: 65, note: "Adequate zygomatic width" }, { k: "Projection", v: 58, note: "Underdeveloped midface" }] },
      ].map((cat) => (
        <div key={cat.title} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "4%", padding: "4% 5%", marginBottom: "3.5%" }}>
          <div style={{ color: LIME, fontSize: "3%", fontWeight: 700, letterSpacing: "0.1em" }}>{cat.title}</div>
          <div style={{ color: MUTED, fontSize: "2.8%", marginBottom: "3%" }}>{cat.sub}</div>
          {cat.metrics.map((m) => (
            <div key={m.k} style={{ marginBottom: "2.5%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.8)", fontSize: "3%", marginBottom: "1%" }}>
                <span>{m.k}</span>
                <span style={{ color: m.v >= 70 ? LIME : "#fff" }}>{m.v}</span>
              </div>
              <div style={{ height: "1.2%", background: "rgba(255,255,255,0.08)", borderRadius: 99 }}>
                <div style={{ width: `${m.v}%`, height: "100%", background: `linear-gradient(90deg, ${LIME}aa, ${LIME})`, borderRadius: 99 }} />
              </div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "2.6%", marginTop: "0.8%" }}>{m.note}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DailyScreen() {
  const exercises = [
    { name: "Mewing Hold", area: "Jawline", done: true },
    { name: "Cheek Sculptor", area: "Cheekbones", done: true },
    { name: "Jaw Clench", area: "Jawline", done: false },
    { name: "Neck Flex", area: "Full Face", done: false },
    { name: "Eye Squeeze", area: "Eye Area", done: false },
  ];
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: BLACK,
        display: "flex",
        flexDirection: "column",
        padding: "8% 6% 5%",
        boxSizing: "border-box",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "3.2%", marginBottom: "2%" }}>9:41</div>
      <div style={{ color: LIME, fontSize: "3.2%", fontWeight: 600, letterSpacing: "0.1em", marginBottom: "2%" }}>TODAY'S WORKOUT</div>
      {/* Streak */}
      <div style={{ display: "flex", alignItems: "center", gap: "2%", marginBottom: "5%" }}>
        <span style={{ fontSize: "5%", color: "#FF6B35" }}>🔥</span>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: "3.8%" }}>12 day streak</span>
      </div>
      {/* Progress ring */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "4%", padding: "5%", marginBottom: "4%", display: "flex", alignItems: "center", gap: "5%" }}>
        <div style={{ position: "relative", width: "22%", aspectRatio: "1/1" }}>
          <svg viewBox="0 0 60 60" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
            <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
            <circle cx="30" cy="30" r="26" fill="none" stroke={LIME} strokeWidth="5" strokeDasharray={`${2 * Math.PI * 26 * 0.4} ${2 * Math.PI * 26 * 0.6}`} strokeLinecap="round" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "3.5%" }}>2/5</div>
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: "3.8%" }}>3 exercises left</div>
          <div style={{ color: MUTED, fontSize: "2.8%" }}>Targeting Jawline & Cheekbones</div>
        </div>
      </div>
      {/* Exercise list */}
      {exercises.map((ex) => (
        <div key={ex.name} style={{ display: "flex", alignItems: "center", background: CARD, border: `1px solid ${ex.done ? BORDER : "rgba(255,255,255,0.06)"}`, borderRadius: "3%", padding: "3% 4%", marginBottom: "2.2%" }}>
          <div style={{ width: "10%", aspectRatio: "1/1", borderRadius: "50%", background: ex.done ? LIME : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "4%", flexShrink: 0 }}>
            {ex.done && <span style={{ fontSize: "4%", color: BLACK, fontWeight: 800 }}>✓</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: ex.done ? MUTED : "#fff", fontWeight: 600, fontSize: "3.2%", textDecoration: ex.done ? "line-through" : "none" }}>{ex.name}</div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "2.6%" }}>{ex.area}</div>
          </div>
          {!ex.done && <div style={{ background: LIME, borderRadius: 99, padding: "1.5% 4%", color: BLACK, fontWeight: 700, fontSize: "2.8%" }}>Start</div>}
        </div>
      ))}
    </div>
  );
}

function ProgressScreen() {
  const weeks = [
    { w: "W1", score: 54 },
    { w: "W2", score: 58 },
    { w: "W3", score: 62 },
    { w: "W4", score: 65 },
    { w: "W6", score: 71 },
    { w: "W8", score: 76 },
  ];
  const max = 100;
  const barH = 16;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: BLACK,
        display: "flex",
        flexDirection: "column",
        padding: "8% 6% 5%",
        boxSizing: "border-box",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "3.2%", marginBottom: "2%" }}>9:41</div>
      <div style={{ color: LIME, fontSize: "3.2%", fontWeight: 600, letterSpacing: "0.1em", marginBottom: "4%" }}>YOUR PROGRESS</div>
      {/* Tier change */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "4%", padding: "5%", marginBottom: "5%" }}>
        <div style={{ color: MUTED, fontSize: "2.8%", marginBottom: "3%" }}>Tier progression</div>
        <div style={{ display: "flex", alignItems: "center", gap: "3%", marginBottom: "4%" }}>
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "2%", padding: "2% 4%", color: MUTED, fontWeight: 700, fontSize: "3.2%" }}>Mid Normie</div>
          <div style={{ color: LIME, fontSize: "5%", fontWeight: 900 }}>→</div>
          <div style={{ background: `${LIME}22`, border: `1px solid ${LIME}66`, borderRadius: "2%", padding: "2% 4%", color: LIME, fontWeight: 700, fontSize: "3.2%" }}>Chad Lite</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: MUTED, fontSize: "2.8%" }}>
          <span>Started at 54</span><span style={{ color: LIME, fontWeight: 700 }}>+22 points</span>
        </div>
      </div>
      {/* Bar chart */}
      <div style={{ color: MUTED, fontSize: "2.8%", marginBottom: "3%" }}>Score over time</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "3%", height: "22%", marginBottom: "1%" }}>
        {weeks.map((w, i) => {
          const isLast = i === weeks.length - 1;
          const pct = (w.score / max) * 100;
          return (
            <div key={w.w} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
              <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                <div style={{ width: "100%", height: `${pct}%`, background: isLast ? LIME : `${LIME}55`, borderRadius: "4px 4px 0 0" }} />
              </div>
              <div style={{ color: isLast ? LIME : MUTED, fontSize: "2.6%", marginTop: "4%", fontWeight: isLast ? 700 : 400 }}>{w.w}</div>
            </div>
          );
        })}
      </div>
      {/* Recent scans */}
      <div style={{ color: MUTED, fontSize: "2.8%", margin: "4% 0 2%" }}>Recent scans</div>
      {[{ date: "Today", score: 76, change: "+4" }, { date: "7 days ago", score: 72, change: "+3" }, { date: "14 days ago", score: 69, change: "+5" }].map((s) => (
        <div key={s.date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3% 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ color: MUTED, fontSize: "3%" }}>{s.date}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "3%" }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "3.2%" }}>{s.score}</span>
            <span style={{ color: LIME, fontSize: "2.8%", background: `${LIME}22`, padding: "1% 2.5%", borderRadius: 99 }}>{s.change}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScanScreen() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8% 6% 10%",
        boxSizing: "border-box",
        fontFamily: "Inter, sans-serif",
        position: "relative",
      }}
    >
      {/* "Camera feed" */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)" }} />
      {/* Face outline */}
      <div style={{ position: "absolute", top: "18%", left: "50%", transform: "translateX(-50%)", width: "55%", aspectRatio: "3/4" }}>
        <svg viewBox="0 0 150 200" style={{ width: "100%", height: "100%" }}>
          <ellipse cx="75" cy="95" rx="65" ry="85" fill="none" stroke={LIME} strokeWidth="1.5" strokeDasharray="6 4" opacity="0.8" />
          {/* Corner brackets */}
          {[[-5, -5, 1, 0, 0, 1], [155, -5, -1, 0, 0, 1], [-5, 205, 1, 0, 0, -1], [155, 205, -1, 0, 0, -1]].map(([x, y, sx, , , sy], i) => (
            <g key={i} transform={`translate(${x},${y}) scale(${sx || 1},${sy || 1})`}>
              <path d="M0,12 L0,0 L12,0" fill="none" stroke={LIME} strokeWidth="2.5" strokeLinecap="round" />
            </g>
          ))}
        </svg>
      </div>
      {/* Top bar */}
      <div style={{ position: "relative", zIndex: 10, color: "rgba(255,255,255,0.5)", fontSize: "3.5%", width: "100%", display: "flex", justifyContent: "space-between" }}>
        <span>9:41</span><span>●●●</span>
      </div>
      {/* Bottom card */}
      <div style={{ position: "relative", zIndex: 10, background: "rgba(17,17,17,0.95)", border: `1px solid ${BORDER}`, borderRadius: "5%", padding: "5% 6%", width: "100%", boxSizing: "border-box" }}>
        <div style={{ color: LIME, fontSize: "3%", fontWeight: 600, letterSpacing: "0.1em", marginBottom: "2%" }}>FACE SCAN</div>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: "4.5%", marginBottom: "2%" }}>Frontal photo</div>
        <div style={{ color: MUTED, fontSize: "3%", marginBottom: "5%" }}>Face the camera directly. Neutral expression, good lighting.</div>
        <div style={{ background: LIME, borderRadius: 99, padding: "3% 0", textAlign: "center", color: BLACK, fontWeight: 800, fontSize: "3.8%" }}>Capture</div>
      </div>
    </div>
  );
}

// ─── Slides ───────────────────────────────────────────────────────────────────

// Slide 1 — Hero
function Slide1() {
  return (
    <div
      style={{
        width: W,
        height: H,
        background: BLACK,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: `${H * 0.07}px ${W * 0.09}px ${H * 0.0}px`,
        boxSizing: "border-box",
      }}
    >
      {/* Background glows */}
      <LimeGlow size={W * 0.9} opacity={0.12} style={{ top: H * 0.45, left: W * -0.15 }} />
      <LimeGlow size={W * 0.5} opacity={0.08} style={{ top: H * 0.1, right: W * -0.1 }} />

      {/* Grid lines subtle */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(180,243,77,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(180,243,77,0.03) 1px, transparent 1px)`, backgroundSize: `${W * 0.12}px ${W * 0.12}px` }} />

      {/* App icon + name */}
      <div style={{ position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: W * 0.04, marginBottom: H * 0.06 }}>
          <div style={{
            width: W * 0.16, height: W * 0.16, borderRadius: W * 0.035,
            background: `linear-gradient(135deg, ${LIME} 0%, #8BC34A 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 ${W * 0.05}px ${LIME}55`,
          }}>
            <span style={{ fontSize: W * 0.09, fontWeight: 900, color: BLACK, lineHeight: 1 }}>S</span>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: W * 0.052 }}>Sigma Max</div>
            <div style={{ color: LIME, fontSize: W * 0.028, fontWeight: 600, letterSpacing: "0.12em" }}>FACIAL TRAINING</div>
          </div>
        </div>
        <Caption
          label="Your potential"
          headline={<>Your face,<br />unlocked.</>}
          sub={"AI facial scoring + daily training\nto reach your peak look."}
          canvasW={W}
        />
      </div>

      {/* Phone */}
      <div style={{ position: "relative", zIndex: 10, display: "flex", justifyContent: "center" }}>
        <Phone style={{ width: W * 0.84, transform: `translateY(${H * 0.08}px)` }}>
          <ScoreScreen />
        </Phone>
      </div>
    </div>
  );
}

// Slide 2 — Face Scan
function Slide2() {
  return (
    <div
      style={{
        width: W,
        height: H,
        background: `linear-gradient(160deg, #0f1a08 0%, ${BLACK} 40%, #0d0d0d 100%)`,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, sans-serif",
        display: "flex",
        flexDirection: "column",
        padding: `${H * 0.07}px ${W * 0.09}px`,
        boxSizing: "border-box",
      }}
    >
      <LimeGlow size={W * 0.7} opacity={0.15} style={{ top: H * -0.05, right: W * -0.2 }} />

      <div style={{ position: "relative", zIndex: 10, marginBottom: H * 0.05 }}>
        <Caption
          label="Step 1"
          headline={<>Scan.<br />In 60 seconds.</>}
          sub="Two photos. AI maps your full facial structure — no guesswork."
          canvasW={W}
        />
      </div>

      {/* Two phones layered */}
      <div style={{ position: "relative", zIndex: 10, flex: 1, display: "flex", alignItems: "flex-end" }}>
        {/* Back phone */}
        <Phone style={{ position: "absolute", left: W * -0.06, width: W * 0.62, transform: "rotate(-5deg) translateY(8%)", opacity: 0.5 }}>
          <ScoreScreen />
        </Phone>
        {/* Front phone */}
        <Phone style={{ position: "absolute", right: W * -0.04, width: W * 0.78, transform: "translateY(6%)" }}>
          <ScanScreen />
        </Phone>
      </div>
    </div>
  );
}

// Slide 3 — Advanced Analysis (light contrast slide)
function Slide3() {
  return (
    <div
      style={{
        width: W,
        height: H,
        background: `linear-gradient(170deg, ${LIME} 0%, #8FD428 35%, #6BAD1A 100%)`,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, sans-serif",
        display: "flex",
        flexDirection: "column",
        padding: `${H * 0.07}px ${W * 0.09}px`,
        boxSizing: "border-box",
      }}
    >
      {/* Dark blobs for texture */}
      <div style={{ position: "absolute", top: H * 0.3, right: W * -0.2, width: W * 0.8, height: W * 0.8, borderRadius: "50%", background: "rgba(0,0,0,0.1)", filter: `blur(${W * 0.15}px)` }} />
      <div style={{ position: "absolute", bottom: H * 0.05, left: W * -0.3, width: W * 0.9, height: W * 0.9, borderRadius: "50%", background: "rgba(0,0,0,0.08)", filter: `blur(${W * 0.2}px)` }} />

      <div style={{ position: "relative", zIndex: 10, marginBottom: H * 0.05 }}>
        <Caption
          label="Step 2"
          headline={<>Know exactly<br />what to fix.</>}
          sub="AI breaks down every feature — jawline, cheekbones, eyes, skin."
          canvasW={W}
          light
        />
      </div>

      {/* Centered phone */}
      <div style={{ position: "relative", zIndex: 10, flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
        <Phone style={{ width: W * 0.82, transform: `translateY(${H * 0.11}px)` }}>
          <AnalysisScreen />
        </Phone>
      </div>
    </div>
  );
}

// Slide 4 — Daily Program
function Slide4() {
  return (
    <div
      style={{
        width: W,
        height: H,
        background: `linear-gradient(175deg, #111 0%, ${BLACK} 100%)`,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, sans-serif",
        display: "flex",
        flexDirection: "column",
        padding: `${H * 0.07}px ${W * 0.09}px`,
        boxSizing: "border-box",
      }}
    >
      <LimeGlow size={W * 0.6} opacity={0.14} style={{ bottom: H * 0.15, left: W * -0.15 }} />
      <LimeGlow size={W * 0.4} opacity={0.08} style={{ top: H * 0.05, right: W * 0.0 }} />

      <div style={{ position: "relative", zIndex: 10, marginBottom: H * 0.05 }}>
        <Caption
          label="Step 3"
          headline={<>5 minutes.<br />Real change.</>}
          sub="A custom daily routine targeting your weakest areas."
          canvasW={W}
        />
      </div>

      <div style={{ position: "relative", zIndex: 10, flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
        <Phone style={{ width: W * 0.83, transform: `translateY(${H * 0.1}px)` }}>
          <DailyScreen />
        </Phone>
      </div>
    </div>
  );
}

// Slide 5 — Progress Tracking
function Slide5() {
  return (
    <div
      style={{
        width: W,
        height: H,
        background: BLACK,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, sans-serif",
        display: "flex",
        flexDirection: "column",
        padding: `${H * 0.07}px ${W * 0.09}px`,
        boxSizing: "border-box",
      }}
    >
      <LimeGlow size={W * 0.65} opacity={0.11} style={{ top: H * 0.4, right: W * -0.1 }} />

      {/* Floating stat cards */}
      <div style={{
        position: "absolute", zIndex: 20, top: H * 0.26, left: W * 0.02,
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: W * 0.03,
        padding: `${H * 0.02}px ${W * 0.04}px`, transform: "rotate(-2deg)",
        boxShadow: `0 ${W * 0.02}px ${W * 0.06}px rgba(0,0,0,0.5)`,
      }}>
        <div style={{ color: LIME, fontWeight: 800, fontSize: W * 0.052 }}>+22</div>
        <div style={{ color: MUTED, fontSize: W * 0.028 }}>pts in 8 weeks</div>
      </div>

      <div style={{
        position: "absolute", zIndex: 20, top: H * 0.33, right: W * 0.0,
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: W * 0.03,
        padding: `${H * 0.018}px ${W * 0.04}px`, transform: "rotate(2.5deg)",
        boxShadow: `0 ${W * 0.02}px ${W * 0.06}px rgba(0,0,0,0.5)`,
      }}>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: W * 0.04 }}>Mid Normie</div>
        <div style={{ color: MUTED, fontSize: W * 0.024 }}>↓</div>
        <div style={{ color: LIME, fontWeight: 800, fontSize: W * 0.04 }}>Chad Lite</div>
      </div>

      <div style={{ position: "relative", zIndex: 10, marginBottom: H * 0.05 }}>
        <Caption
          label="Progress"
          headline={<>Watch yourself<br />ascend.</>}
          sub="Weekly scans track every point gained. Your tier updates in real time."
          canvasW={W}
        />
      </div>

      <div style={{ position: "relative", zIndex: 10, flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
        <Phone style={{ width: W * 0.83, transform: `translateY(${H * 0.1}px)` }}>
          <ProgressScreen />
        </Phone>
      </div>
    </div>
  );
}

// Slide 6 — More Features / CTA
function Slide6() {
  const features = [
    "AI Face Scoring",
    "7 Facial Metrics",
    "Advanced Analysis",
    "Daily Training Plan",
    "Streak Tracker",
    "Tier System",
    "Progress Scans",
    "Personalized Goals",
  ];
  return (
    <div
      style={{
        width: W,
        height: H,
        background: `linear-gradient(170deg, #0f1a08 0%, ${BLACK} 50%)`,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: `${H * 0.07}px ${W * 0.1}px`,
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      <LimeGlow size={W * 1.1} opacity={0.1} style={{ top: H * 0.2, left: W * -0.05 }} />
      <LimeGlow size={W * 0.5} opacity={0.08} style={{ bottom: H * 0.1, right: W * -0.1 }} />

      {/* App icon */}
      <div style={{
        position: "relative", zIndex: 10,
        width: W * 0.22, height: W * 0.22, borderRadius: W * 0.05,
        background: `linear-gradient(135deg, ${LIME} 0%, #8BC34A 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 0 ${W * 0.08}px ${LIME}44`,
        marginBottom: H * 0.04,
      }}>
        <span style={{ fontSize: W * 0.12, fontWeight: 900, color: BLACK, lineHeight: 1 }}>S</span>
      </div>

      <div style={{ position: "relative", zIndex: 10, marginBottom: H * 0.06 }}>
        <Caption
          label="Sigma Max"
          headline={<>And so<br />much more.</>}
          canvasW={W}
          center
        />
      </div>

      {/* Feature pills */}
      <div style={{
        position: "relative", zIndex: 10,
        display: "flex", flexWrap: "wrap", gap: W * 0.025,
        justifyContent: "center", marginBottom: H * 0.06,
      }}>
        {features.map((f) => (
          <div key={f} style={{
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${BORDER}`,
            borderRadius: 999,
            padding: `${H * 0.012}px ${W * 0.045}px`,
            color: "#fff", fontSize: W * 0.032, fontWeight: 500,
          }}>
            {f}
          </div>
        ))}
      </div>

      {/* Social proof */}
      <div style={{
        position: "relative", zIndex: 10,
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: W * 0.04,
        padding: `${H * 0.03}px ${W * 0.06}px`, textAlign: "center",
        marginBottom: H * 0.05,
      }}>
        <div style={{ color: LIME, fontWeight: 900, fontSize: W * 0.065, marginBottom: H * 0.008 }}>35,000+</div>
        <div style={{ color: MUTED, fontSize: W * 0.032 }}>Faces looksmaxxed</div>
        <div style={{ color: "rgba(255,200,0,0.9)", fontSize: W * 0.038, marginTop: H * 0.012 }}>★★★★★ 4.8</div>
      </div>

      {/* CTA */}
      <div style={{
        position: "relative", zIndex: 10,
        background: LIME, borderRadius: 999,
        padding: `${H * 0.022}px ${W * 0.14}px`,
        color: BLACK, fontWeight: 800, fontSize: W * 0.048,
      }}>
        Start Ascending
      </div>
    </div>
  );
}

// ─── All slides registry ──────────────────────────────────────────────────────
const SLIDES = [
  { id: "hero", component: Slide1 },
  { id: "scan", component: Slide2 },
  { id: "analysis", component: Slide3 },
  { id: "daily", component: Slide4 },
  { id: "progress", component: Slide5 },
  { id: "more", component: Slide6 },
];

// ─── Screenshot preview with scaling ─────────────────────────────────────────
function ScreenshotPreview({
  id,
  children,
  exportRef,
  onExport,
}: {
  id: string;
  children: React.ReactNode;
  exportRef: React.RefObject<HTMLDivElement | null>;
  onExport: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setScale(el.clientWidth / W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      onClick={onExport}
      title="Click to export"
      style={{
        width: "100%",
        aspectRatio: `${W}/${H}`,
        position: "relative",
        cursor: "pointer",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
      }}
    >
      {/* Preview (scaled) */}
      <div
        style={{
          position: "absolute",
          top: 0, left: 0,
          width: W,
          height: H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>

      {/* Hover overlay */}
      <div
        style={{
          position: "absolute", inset: 0,
          background: "rgba(180,243,77,0.0)",
          transition: "background 0.2s",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        className="export-overlay"
      >
        <span
          style={{
            color: "#fff", fontSize: 13, fontWeight: 700,
            background: "rgba(0,0,0,0.7)", borderRadius: 6,
            padding: "4px 10px", opacity: 0, transition: "opacity 0.2s",
          }}
          className="export-label"
        >
          Export
        </span>
      </div>

      {/* Offscreen export target */}
      <div
        ref={exportRef}
        style={{
          position: "absolute",
          left: -9999,
          top: 0,
          width: W,
          height: H,
          fontFamily: "Inter, sans-serif",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ScreenshotsPage() {
  const [selectedSize, setSelectedSize] = useState(0);
  const [exporting, setExporting] = useState<string | null>(null);

  const exportRefs = useRef<Record<string, React.RefObject<HTMLDivElement | null>>>({});
  SLIDES.forEach(({ id }) => {
    if (!exportRefs.current[id]) {
      exportRefs.current[id] = { current: null };
    }
  });

  const doExport = useCallback(
    async (slideId: string, index: number) => {
      const el = exportRefs.current[slideId]?.current;
      if (!el) return;
      setExporting(slideId);

      const size = SIZES[selectedSize];
      const scaleX = size.w / W;
      const scaleY = size.h / H;

      el.style.left = "0px";
      el.style.opacity = "1";
      el.style.zIndex = "-1";

      try {
        const opts = { width: W, height: H, pixelRatio: 1, cacheBust: true };
        await toPng(el, opts); // warm-up
        const dataUrl = await toPng(el, opts);

        const img = new window.Image();
        img.src = dataUrl;
        await new Promise((r) => (img.onload = r));

        const canvas = document.createElement("canvas");
        canvas.width = size.w;
        canvas.height = size.h;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(scaleX, scaleY);
        ctx.drawImage(img, 0, 0);

        const link = document.createElement("a");
        link.download = `${String(index + 1).padStart(2, "0")}-${slideId}-${size.w}x${size.h}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } finally {
        el.style.left = "-9999px";
        el.style.opacity = "";
        el.style.zIndex = "";
        setExporting(null);
      }
    },
    [selectedSize]
  );

  const exportAll = async () => {
    for (let i = 0; i < SLIDES.length; i++) {
      await doExport(SLIDES[i].id, i);
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  return (
    <>
      <style>{`
        body { margin: 0; background: #0a0a0a; }
        .export-overlay:hover { background: rgba(180,243,77,0.08) !important; }
        .export-overlay:hover .export-label { opacity: 1 !important; }
      `}</style>

      {/* Toolbar */}
      <div
        style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "#111", borderBottom: "1px solid #222",
          padding: "12px 24px", display: "flex", alignItems: "center", gap: 16,
          fontFamily: "Inter, sans-serif",
        }}
      >
        <span style={{ color: "#B4F34D", fontWeight: 800, fontSize: 18 }}>Sigma Max</span>
        <span style={{ color: "#555", fontSize: 14 }}>App Store Screenshots</span>
        <div style={{ flex: 1 }} />
        <select
          value={selectedSize}
          onChange={(e) => setSelectedSize(Number(e.target.value))}
          style={{
            background: "#222", border: "1px solid #333", color: "#fff",
            borderRadius: 6, padding: "6px 10px", fontSize: 13, cursor: "pointer",
          }}
        >
          {SIZES.map((s, i) => (
            <option key={s.label} value={i}>{s.label} — {s.w}×{s.h}</option>
          ))}
        </select>
        <button
          onClick={exportAll}
          disabled={!!exporting}
          style={{
            background: "#B4F34D", color: "#0B0B0B", fontWeight: 700,
            border: "none", borderRadius: 8, padding: "8px 20px",
            fontSize: 13, cursor: exporting ? "wait" : "pointer",
            opacity: exporting ? 0.6 : 1,
          }}
        >
          {exporting ? `Exporting ${exporting}…` : "Export All"}
        </button>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 24,
          padding: 32,
          maxWidth: 1600,
          margin: "0 auto",
        }}
      >
        {SLIDES.map(({ id, component: Slide }, i) => (
          <div key={id}>
            <div style={{ color: "#555", fontSize: 12, fontFamily: "Inter, sans-serif", marginBottom: 6 }}>
              {String(i + 1).padStart(2, "0")} — {id}
            </div>
            <ScreenshotPreview
              id={id}
              exportRef={exportRefs.current[id] as React.RefObject<HTMLDivElement>}
              onExport={() => doExport(id, i)}
            >
              <Slide />
            </ScreenshotPreview>
          </div>
        ))}
      </div>
    </>
  );
}
