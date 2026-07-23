import React from 'react';

export default function KissIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 60" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="lipGrad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="#d31027" />
          <stop offset="100%" stopColor="#ea384d" />
        </radialGradient>
      </defs>
      <path
        fill="url(#lipGrad)"
        d="M 15 30
           C 25 20, 35 15, 50 20
           C 65 15, 75 20, 85 30
           C 75 35, 65 38, 50 35
           C 35 38, 25 35, 15 30 Z"
      />
      <path
        fill="url(#lipGrad)"
        d="M 15 30
           C 25 40, 40 48, 50 48
           C 60 48, 75 40, 85 30
           C 75 42, 60 44, 50 44
           C 40 44, 25 42, 15 30 Z"
      />
    </svg>
  );
}
