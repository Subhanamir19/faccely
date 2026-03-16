"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toPng } from "html-to-image";

// ─── Canvas dimensions ────────────────────────────────────────────────────────
const W = 1320;
const H = 2868;

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const LIME = "#B4F34D";
const BLACK = "#080808";
const MUTED = "rgba(255,255,255,0.5)";

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

// ─── Phone component ──────────────────────────────────────────────────────────
function Phone({
  src,
  alt = "",
  style,
}: {
  src: string;
  alt?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ position: "relative", aspectRatio: `${MK_W}/${MK_H}`, ...style }}>
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
          draggable={false}
        />
      </div>
    </div>
  );
}

// ─── LimeGlow ─────────────────────────────────────────────────────────────────
function LimeGlow({ size, opacity = 0.2, style }: { size: number; opacity?: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        background: LIME,
        filter: `blur(${size * 0.4}px)`,
        opacity,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

// ─── Caption ──────────────────────────────────────────────────────────────────
function Caption({
  label,
  headline,
  sub,
  light = false,
}: {
  label: string;
  headline: React.ReactNode;
  sub?: string;
  light?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: W * 0.028,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase" as const,
          color: light ? "rgba(0,0,0,0.5)" : LIME,
          marginBottom: W * 0.018,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: W * 0.098,
          fontWeight: 800,
          lineHeight: 0.95,
          color: light ? "#0B0B0B" : "#FFFFFF",
        }}
      >
        {headline}
      </div>
      {sub && (
        <div
          style={{
            fontSize: W * 0.036,
            fontWeight: 400,
            lineHeight: 1.4,
            color: light ? "rgba(0,0,0,0.55)" : MUTED,
            marginTop: W * 0.022,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Slide 1 — Hero ───────────────────────────────────────────────────────────
// achieveyour10-by-10-version.jpeg — dark cinematic shot
function Slide1() {
  return (
    <div
      style={{
        width: W,
        height: H,
        background: BLACK,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Poppins, sans-serif",
        display: "flex",
        flexDirection: "column",
        padding: `${H * 0.07}px ${W * 0.09}px 0`,
        boxSizing: "border-box",
      }}
    >
      {/* Subtle lime radial at bottom */}
      <LimeGlow size={W * 1.1} opacity={0.13} style={{ bottom: H * -0.1, left: W * -0.05 }} />
      {/* Faint top-right glow */}
      <LimeGlow size={W * 0.45} opacity={0.06} style={{ top: H * 0.06, right: W * -0.1 }} />

      {/* App wordmark */}
      <div style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "center", gap: W * 0.035, marginBottom: H * 0.055 }}>
        <div
          style={{
            width: W * 0.14,
            height: W * 0.14,
            borderRadius: W * 0.032,
            background: `linear-gradient(145deg, ${LIME} 0%, #8FD428 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 ${W * 0.05}px ${LIME}55`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: W * 0.08, fontWeight: 900, color: "#0B0B0B", lineHeight: 1 }}>S</span>
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: W * 0.048, lineHeight: 1 }}>Sigma Max</div>
          <div style={{ color: LIME, fontSize: W * 0.025, fontWeight: 600, letterSpacing: "0.13em", marginTop: 4 }}>LOOKSMAXX SMARTER</div>
        </div>
      </div>

      {/* Caption */}
      <div style={{ position: "relative", zIndex: 10, marginBottom: H * 0.05 }}>
        <Caption
          label="Your potential"
          headline={<>There&apos;s a face<br />under your face.</>}
          sub="SigmaMax helps you unlock it."
        />
      </div>

      {/* Phone — centered, slight bleed */}
      <div style={{ position: "relative", zIndex: 10, flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
        <Phone
          src="/ss/hero.jpeg"
          alt="Sigma Max hero"
          style={{ width: W * 0.76, transform: `translateY(${H * 0.03}px)` }}
        />
      </div>
    </div>
  );
}

// ─── Slide 2 — AI Face Scan ───────────────────────────────────────────────────
// analysis-ss.png — lime contrast slide
function Slide2() {
  return (
    <div
      style={{
        width: W,
        height: H,
        background: `linear-gradient(165deg, ${LIME} 0%, #9ADE2E 30%, #72B518 100%)`,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Poppins, sans-serif",
        display: "flex",
        flexDirection: "column",
        padding: `${H * 0.07}px ${W * 0.09}px 0`,
        boxSizing: "border-box",
      }}
    >
      {/* Dark texture blobs */}
      <div style={{ position: "absolute", top: H * 0.25, right: W * -0.25, width: W * 0.85, height: W * 0.85, borderRadius: "50%", background: "rgba(0,0,0,0.12)", filter: `blur(${W * 0.18}px)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: H * 0.1, left: W * -0.3, width: W * 0.9, height: W * 0.9, borderRadius: "50%", background: "rgba(0,0,0,0.08)", filter: `blur(${W * 0.22}px)`, pointerEvents: "none" }} />

      {/* Caption */}
      <div style={{ position: "relative", zIndex: 10, marginBottom: H * 0.05 }}>
        <Caption
          label="AI Analysis"
          headline={<>Get your score<br />in seconds.</>}
          sub="AI maps your full facial structure — every angle, every metric."
          light
        />
      </div>

      {/* Phone — centered */}
      <div style={{ position: "relative", zIndex: 10, flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
        <Phone
          src="/ss/scan.png"
          alt="Face scan"
          style={{ width: W * 0.76, transform: `translateY(${H * 0.03}px)` }}
        />
      </div>
    </div>
  );
}

// ─── Slide 3 — Daily Training ─────────────────────────────────────────────────
// routine.jpeg — dark slide
function Slide3() {
  return (
    <div
      style={{
        width: W,
        height: H,
        background: `linear-gradient(175deg, #111111 0%, ${BLACK} 100%)`,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Poppins, sans-serif",
        display: "flex",
        flexDirection: "column",
        padding: `${H * 0.07}px ${W * 0.09}px 0`,
        boxSizing: "border-box",
      }}
    >
      {/* Lime glow bottom-left */}
      <LimeGlow size={W * 0.75} opacity={0.16} style={{ bottom: H * 0.12, left: W * -0.2 }} />
      {/* Faint top-right */}
      <LimeGlow size={W * 0.4} opacity={0.07} style={{ top: H * -0.02, right: W * -0.05 }} />

      {/* Caption */}
      <div style={{ position: "relative", zIndex: 10, marginBottom: H * 0.05 }}>
        <Caption
          label="Daily Training"
          headline={<>5 minutes.<br />Real change.</>}
          sub="A custom plan targeting your weakest areas. Every single day."
        />
      </div>

      {/* Phone — slight right shift for visual variety */}
      <div style={{ position: "relative", zIndex: 10, flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
        <Phone
          src="/ss/routine.jpeg"
          alt="Daily routine"
          style={{ width: W * 0.76, transform: `translateX(${W * 0.03}px) translateY(${H * 0.03}px)` }}
        />
      </div>
    </div>
  );
}

// ─── Slides registry ──────────────────────────────────────────────────────────
const SLIDES = [
  { id: "hero", label: "Hero", component: Slide1 },
  { id: "scan", label: "AI Scan", component: Slide2 },
  { id: "routine", label: "Daily Training", component: Slide3 },
];

// ─── Screenshot preview with ResizeObserver scaling ──────────────────────────
function ScreenshotPreview({
  exportRef,
  onExport,
  children,
}: {
  exportRef: React.RefObject<HTMLDivElement | null>;
  onExport: () => void;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / W));
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
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 6px 32px rgba(0,0,0,0.6)",
      }}
    >
      {/* Scaled preview */}
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
        className="export-overlay"
        style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <span className="export-label" style={{
          color: "#fff", fontSize: 13, fontWeight: 700,
          background: "rgba(0,0,0,0.75)", borderRadius: 6,
          padding: "5px 12px", opacity: 0, transition: "opacity 0.2s",
        }}>
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
          fontFamily: "Poppins, sans-serif",
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
    if (!exportRefs.current[id]) exportRefs.current[id] = { current: null };
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
        await toPng(el, opts); // warm-up pass
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
        .export-overlay:hover { background: rgba(180,243,77,0.07) !important; }
        .export-overlay:hover .export-label { opacity: 1 !important; }
      `}</style>

      {/* Toolbar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "#111", borderBottom: "1px solid #1e1e1e",
        padding: "12px 24px", display: "flex", alignItems: "center", gap: 16,
        fontFamily: "Poppins, sans-serif",
      }}>
        <span style={{ color: LIME, fontWeight: 800, fontSize: 18 }}>Sigma Max</span>
        <span style={{ color: "#444", fontSize: 13 }}>App Store Screenshots</span>
        <div style={{ flex: 1 }} />
        <select
          value={selectedSize}
          onChange={(e) => setSelectedSize(Number(e.target.value))}
          style={{
            background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff",
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
            background: LIME, color: "#0B0B0B", fontWeight: 700,
            border: "none", borderRadius: 8, padding: "8px 20px",
            fontSize: 13, cursor: exporting ? "wait" : "pointer",
            opacity: exporting ? 0.6 : 1,
          }}
        >
          {exporting ? `Exporting ${exporting}…` : "Export All"}
        </button>
      </div>

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 32,
        padding: "40px 40px",
        maxWidth: 1200,
        margin: "0 auto",
      }}>
        {SLIDES.map(({ id, label, component: Slide }, i) => (
          <div key={id}>
            <div style={{ color: "#444", fontSize: 12, fontFamily: "Poppins, sans-serif", marginBottom: 8 }}>
              <span style={{ color: LIME, fontWeight: 700 }}>{String(i + 1).padStart(2, "0")}</span>{" "}— {label}
            </div>
            <ScreenshotPreview
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
