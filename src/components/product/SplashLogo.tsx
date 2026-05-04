'use client'

interface SplashLogoProps {
  size?: number
}

export function SplashLogo({ size = 64 }: SplashLogoProps) {
  return (
    <div className="inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={size} height={size} className="animate-pulse-slow">
        <defs>
          <linearGradient id="splashGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <path
          d="M48 18 A18 18 0 1 0 48 46"
          fill="none"
          stroke="url(#splashGrad)"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </svg>
      <style jsx>{`
        @keyframes pulse-slow {
          0%,
          100% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
