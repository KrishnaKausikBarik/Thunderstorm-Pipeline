import React, { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  Zap,
  Satellite,
  BarChart3,
  Minimize2,
  BookOpen,
  ShieldCheck,
  Cpu,
  Radio,
} from "lucide-react";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Ambient aesthetic background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Aurora gradient wash — slow drift */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 20% 0%, rgba(139,92,246,0.25), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 10%, rgba(236,72,153,0.22), transparent 60%), radial-gradient(ellipse 70% 50% at 50% 100%, rgba(139,92,246,0.18), transparent 60%)",
            animation: "aurora-drift 20s ease-in-out infinite alternate",
          }}
        />

        {/* Animated blurred blobs */}
        <div
          className="absolute -top-20 -left-20 h-[300px] w-[300px] md:-top-40 md:-left-40 md:h-[620px] md:w-[620px] rounded-full blur-[80px] md:blur-[120px]"
          style={{
            background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)",
            opacity: 0.5,
            animation: "blob-drift 18s ease-in-out infinite",
          }}
        />
        <div
          className="absolute top-20 -right-20 h-[350px] w-[350px] md:top-40 md:-right-40 md:h-[680px] md:w-[680px] rounded-full blur-[90px] md:blur-[130px]"
          style={{
            background: "radial-gradient(circle, #ec4899 0%, transparent 70%)",
            opacity: 0.45,
            animation: "blob-drift 22s ease-in-out infinite -6s",
          }}
        />
        <div
          className="absolute top-[300px] -left-10 h-[250px] w-[250px] md:top-[820px] md:left-1/4 md:h-[560px] md:w-[560px] rounded-full blur-[80px] md:blur-[120px]"
          style={{
            background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)",
            opacity: 0.5,
            animation: "blob-drift 16s ease-in-out infinite -12s",
          }}
        />
        <div
          className="absolute bottom-10 -right-10 h-[250px] w-[250px] md:bottom-0 md:right-1/4 md:h-[500px] md:w-[500px] rounded-full blur-[90px] md:blur-[130px]"
          style={{
            background: "radial-gradient(circle, #ec4899 0%, transparent 70%)",
            opacity: 0.45,
            animation: "blob-drift 20s ease-in-out infinite -9s",
          }}
        />

        {/* Soft floating circles — always moving */}
        <div
          className="absolute top-[15%] left-[12%] h-3 w-3 rounded-full hidden lg:block"
          style={{
            background: '#8b5cf6',
            boxShadow: '0 0 20px 6px rgba(139,92,246,0.4)',
            animation: 'particle-1 12s ease-in-out infinite',
          }}
        />
        <div
          className="absolute top-[22%] right-[18%] h-2 w-2 rounded-full hidden lg:block"
          style={{
            background: '#ec4899',
            boxShadow: '0 0 18px 5px rgba(236,72,153,0.4)',
            animation: 'particle-2 14s ease-in-out infinite -4s',
          }}
        />
        <div
          className="absolute top-[55%] left-[6%] h-2.5 w-2.5 rounded-full hidden lg:block"
          style={{
            background: '#a78bfa',
            boxShadow: '0 0 16px 5px rgba(167,139,250,0.35)',
            animation: 'particle-3 10s ease-in-out infinite -2s',
          }}
        />
        <div
          className="absolute top-[70%] right-[8%] h-2 w-2 rounded-full hidden lg:block"
          style={{
            background: '#f472b6',
            boxShadow: '0 0 14px 4px rgba(244,114,182,0.35)',
            animation: 'particle-1 16s ease-in-out infinite -8s',
          }}
        />
        <div
          className="absolute top-[40%] right-[30%] h-1.5 w-1.5 rounded-full hidden lg:block"
          style={{
            background: '#c084fc',
            boxShadow: '0 0 12px 4px rgba(192,132,252,0.3)',
            animation: 'particle-2 11s ease-in-out infinite -6s',
          }}
        />
        <div
          className="absolute top-[85%] left-[25%] h-2 w-2 rounded-full hidden lg:block"
          style={{
            background: '#8b5cf6',
            boxShadow: '0 0 15px 5px rgba(139,92,246,0.35)',
            animation: 'particle-3 13s ease-in-out infinite -3s',
          }}
        />

        {/* Conic accent ring — slow spin */}
        <div
          className="absolute left-1/2 top-[420px] h-[900px] w-[900px] -translate-x-1/2 rounded-full opacity-[0.12] blur-2xl"
          style={{
            background:
              "conic-gradient(from 120deg at 50% 50%, #8b5cf6, transparent 30%, #ec4899, transparent 70%, #8b5cf6)",
            animation: "spin-slow 30s linear infinite",
          }}
        />

        {/* Grid overlay — subtle pulse */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at 50% 20%, black 40%, transparent 80%)",
            animation: "grid-pulse 6s ease-in-out infinite",
          }}
        />

        {/* Floating glass orbs (decorative) — bouncing */}
        <div
          className="glass absolute left-[8%] top-[36%] hidden h-24 w-24 rounded-2xl rotate-12 lg:block"
          style={{
            boxShadow: "0 20px 60px -20px rgba(139,92,246,0.5)",
            animation: "orb-float-1 8s ease-in-out infinite",
          }}
        />
        <div
          className="glass absolute right-[10%] top-[28%] hidden h-16 w-16 rounded-full lg:block"
          style={{
            boxShadow: "0 20px 60px -20px rgba(236,72,153,0.5)",
            animation: "orb-float-2 10s ease-in-out infinite -3s",
          }}
        />
        <div
          className="glass absolute right-[6%] bottom-[22%] hidden h-20 w-20 -rotate-6 rounded-xl lg:block"
          style={{
            boxShadow: "0 20px 60px -20px rgba(139,92,246,0.4)",
            animation: "orb-float-3 9s ease-in-out infinite -5s",
          }}
        />

        {/* Top / bottom vignette */}
        <div
          className="absolute inset-x-0 top-0 h-40"
          style={{ background: 'linear-gradient(to bottom, var(--bg), transparent)' }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-40"
          style={{ background: 'linear-gradient(to top, var(--bg), transparent)' }}
        />
      </div>

      <main className="relative">
        <Hero />
        <TrustBanner />
        <Architecture />
      </main>
    </div>
  );
}



function Hero() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const handleGetStarted = () => {
    if (currentUser) {
      navigate('/app');
    } else {
      navigate('/login');
    }
  };

  return (
    <section className="relative px-6 pt-40 pb-24 sm:pt-48 sm:pb-32">
      <div className="mx-auto max-w-5xl text-center">
        {/* Badge — scale in */}
        <div
          className="glass mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-white/60"
          style={{ animation: 'scale-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) both' }}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#8b5cf6" }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#8b5cf6" }} />
          </span>
          Enterprise Grade Meteorological Pipeline
        </div>

        {/* Title — slide from left */}
        <h1
          className="text-hero mt-8 text-white"
          style={{ animation: 'slide-in-left 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both' }}
        >
          Automated Atmospheric <br/>
          <span className="text-gradient-brand">Data Co-Registration</span>
        </h1>

        {/* Subtitle — slide from right */}
        <p
          className="text-body mx-auto mt-8 max-w-2xl text-white/60"
          style={{ animation: 'slide-in-right 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both' }}
        >
          Seamlessly fetch, clean, merge, and optimize gridded meteorological datasets like ERA5
          and IMD in a unified, high-performance workflow designed for climate scientists.
        </p>

        {/* Buttons — pop up */}
        <div
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          style={{ animation: 'pop-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.45s both' }}
        >
          <button
            onClick={handleGetStarted}
            className="shadow-glow btn-gradient-shift text-button group inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white transition-all duration-500 hover:-translate-y-0.5 w-full sm:w-auto"
          >
            <Zap className="h-4 w-4" fill="white" strokeWidth={2.5} />
            Deploy Pipeline
          </button>
          <button
            className="glass text-button group inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white transition-all duration-300 hover:border-white/25 hover:bg-white/10 w-full sm:w-auto"
          >
            <BookOpen className="h-4 w-4" />
            Read Documentation
          </button>
        </div>
      </div>
    </section>
  );
}

function TrustBanner() {
  const items = [
    { icon: ShieldCheck, label: "Secure Auth" },
    { icon: Cpu, label: "Scalable Processing" },
    { icon: Radio, label: "Real-time Sync" },
  ];
  return (
    <section className="relative px-6 z-10">
      <div className="mx-auto max-w-5xl">
        <div
          className="glass flex flex-col items-center justify-around gap-6 rounded-2xl px-8 py-6 sm:flex-row"
          style={{ animation: 'slide-in-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.55s both' }}
        >
          {items.map(({ icon: Icon, label }, i) => (
            <div
              key={label}
              className="flex items-center gap-3 text-white/60"
              style={{ animation: `fade-in 0.5s ease ${0.65 + i * 0.1}s both` }}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              <span className="text-xs font-semibold uppercase tracking-[0.22em]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Architecture() {
  const cards = [
    {
      icon: Satellite,
      title: "Data Ingestion",
      text: "Select your bounding coordinates on an interactive map and fetch ERA5 and IMD data automatically.",
    },
    {
      icon: BarChart3,
      title: "EDA & Cleaning",
      text: "Automatically detect and impute missing values across thousands of geospatial grid points.",
    },
    {
      icon: Zap,
      title: "Derived Params",
      text: "Calculate complex thermodynamic indices like Virtual Temperature and Theta-E from base variables.",
    },
    {
      icon: Minimize2,
      title: "Dim Reduction",
      text: "Eliminate multicollinearity using Spearman Correlation and Variance Inflation Factor (VIF) scoring.",
    },
  ];

  return (
    <section className="relative px-6 py-24 sm:py-32 z-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <div
            className="glass mx-auto mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/60"
            style={{ animation: 'scale-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.7s both' }}
          >
            Pipeline
          </div>
          <h2
            className="text-section text-white"
            style={{ animation: 'slide-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.8s both' }}
          >
            The 4-Step <span className="text-gradient-brand">Architecture</span>
          </h2>
          <p
            className="text-body mx-auto mt-5 max-w-xl text-white/60"
            style={{ animation: 'fade-in 0.8s ease 0.95s both' }}
          >
            A composable pipeline that turns raw satellite grids into research-ready tensors.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ icon: Icon, title, text }, i) => (
            <div
              key={title}
              style={{ animation: `card-flip-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${1.0 + i * 0.12}s both` }}
            >
              <TiltCard
                className="group relative h-full overflow-hidden rounded-2xl p-6 hover:border-white/20"
                style={{
                  background: 'rgba(23, 23, 36, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
                }}
              >
                <div
                  className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-70"
                  style={{ background: i % 2 === 0 ? "#8b5cf6" : "#ec4899" }}
                />
                <div className="relative">
                  <div className="mb-6 flex items-center justify-between">
                    <span
                      className="grid h-12 w-12 place-items-center rounded-xl transition-transform duration-500 group-hover:scale-110"
                      style={{
                        background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(236,72,153,0.2))",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      <Icon className="h-5 w-5 text-white" strokeWidth={2} />
                    </span>
                    <span className="text-xs font-mono text-white/30">0{i + 1}</span>
                  </div>
                  <h3 className="text-card-title text-white">{title}</h3>
                  <p className="mt-3 text-[14px] text-white/60">{text}</p>
                </div>
              </TiltCard>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

function TiltCard({ children, className, style }: TiltCardProps) {
  const [transform, setTransform] = useState('');

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate rotation (-12 to 12 degrees max based on cursor pos)
    const rotateX = ((y / rect.height) - 0.5) * -24;
    const rotateY = ((x / rect.width) - 0.5) * 24;

    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`);
  };

  const handleMouseLeave = () => {
    setTransform('');
  };

  return (
    <article
      className={className}
      style={{
        ...style,
        transform: transform || undefined,
        transition: transform ? 'transform 0.1s ease-out' : 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        transformStyle: 'preserve-3d'
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </article>
  );
}
