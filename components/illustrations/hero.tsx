export function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 640 480"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hero-grad-1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4a63f5" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="hero-grad-2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
        <linearGradient id="hero-grad-3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
        <filter id="hero-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#141531" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Central hub card */}
      <g filter="url(#hero-shadow)">
        <rect x="220" y="170" width="200" height="140" rx="20" fill="white" />
        <rect x="220" y="170" width="200" height="140" rx="20" stroke="#eef0f7" strokeWidth="1.5" />
      </g>
      <circle cx="256" cy="204" r="12" fill="url(#hero-grad-1)" />
      <rect x="278" y="196" width="90" height="8" rx="4" fill="#e7e9f3" />
      <rect x="278" y="212" width="60" height="8" rx="4" fill="#f0f1f8" />
      <rect x="240" y="236" width="160" height="10" rx="5" fill="#f4f5fa" />
      <rect x="240" y="254" width="120" height="10" rx="5" fill="#f4f5fa" />
      <rect x="240" y="272" width="140" height="10" rx="5" fill="#f4f5fa" />

      {/* Orbiting channel bubbles */}
      <g className="animate-float">
        <circle cx="120" cy="110" r="34" fill="url(#hero-grad-3)" filter="url(#hero-shadow)" />
        <path
          d="M120 96a15 15 0 1 0 6.6 28.4L134 128l-2.6-8.6A15 15 0 0 0 120 96Z"
          fill="white"
          transform="translate(0,-2)"
        />
      </g>

      <g className="animate-float animate-delay-150">
        <circle cx="520" cy="130" r="30" fill="url(#hero-grad-2)" filter="url(#hero-shadow)" />
        <rect x="504" y="118" width="32" height="22" rx="6" fill="white" />
        <path d="M510 140l6-8h16l-6 8Z" fill="white" opacity="0" />
      </g>

      <g className="animate-float animate-delay-300">
        <circle cx="150" cy="340" r="26" fill="url(#hero-grad-1)" filter="url(#hero-shadow)" />
        <rect x="138" y="330" width="24" height="18" rx="5" fill="white" />
      </g>

      <g className="animate-float animate-delay-225">
        <circle cx="500" cy="350" r="32" fill="#0a0a0a" filter="url(#hero-shadow)" />
        <path d="M488 342c0-7 6-13 13-13s13 6 13 13-6 13-13 13c-2 0-4 0-5-1l-8 3 3-7c-2-2-3-5-3-8Z" fill="white" />
      </g>

      {/* Connecting lines */}
      <path d="M150 130 C180 160, 200 180, 224 200" stroke="#dfe2ef" strokeWidth="2" strokeDasharray="4 5" />
      <path d="M492 145 C460 165, 440 180, 418 200" stroke="#dfe2ef" strokeWidth="2" strokeDasharray="4 5" />
      <path d="M170 335 C195 315, 210 300, 226 280" stroke="#dfe2ef" strokeWidth="2" strokeDasharray="4 5" />
      <path d="M475 340 C445 320, 430 305, 412 285" stroke="#dfe2ef" strokeWidth="2" strokeDasharray="4 5" />

      {/* Decorative dots */}
      <circle cx="90" cy="220" r="4" fill="#c7cdf0" />
      <circle cx="560" cy="240" r="4" fill="#f6c9dc" />
      <circle cx="200" cy="80" r="3" fill="#bfe6c9" />
      <circle cx="440" cy="90" r="3" fill="#e6d6ff" />
    </svg>
  );
}
