'use client';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const sizes = {
    sm: { icon: 'w-8 h-8', text: 'text-lg' },
    md: { icon: 'w-10 h-10', text: 'text-xl' },
    lg: { icon: 'w-12 h-12', text: 'text-2xl' },
  };

  return (
    <div className="flex items-center gap-2">
      {/* Logo Icon */}
      <div className={`${sizes[size].icon} relative`}>
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Football shape */}
          <ellipse cx="20" cy="20" rx="18" ry="12" fill="#2563EB" />
          {/* Laces */}
          <path d="M20 10V30" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <path d="M15 14H25" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14 18H26" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14 22H26" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M15 26H25" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          {/* IQ indicator */}
          <circle cx="32" cy="8" r="7" fill="#10B981" />
          <text x="32" y="11" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">IQ</text>
        </svg>
      </div>
      {showText && (
        <span className={`${sizes[size].text} font-bold text-blue-600`}>
          Draft<span className="text-emerald-500">IQ</span>
        </span>
      )}
    </div>
  );
}
