'use client';
import { useId } from 'react';

export function FlagTH({ className }) {
  return (
    <svg viewBox="0 0 30 20" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="30" height="20" fill="#A51931" />
      <rect y="3.33" width="30" height="13.34" fill="#F4F5F8" />
      <rect y="6.67" width="30" height="6.66" fill="#2D2A4A" />
    </svg>
  );
}

export function FlagKH({ className }) {
  return (
    <svg viewBox="0 0 30 20" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="30" height="20" fill="#032EA1" />
      <rect y="5" width="30" height="10" fill="#E00025" />
      {/* Angkor Wat (simplified) */}
      <g fill="#fff">
        <rect x="8.2" y="12.6" width="13.6" height="1.2" />
        <rect x="9" y="11.4" width="12" height="1.2" />
        <path d="M13.6 11.4V8.6l1.4-2.4 1.4 2.4v2.8z" />
        <path d="M10.6 11.4V9.4l1-1.6 1 1.6v2z" />
        <path d="M17.4 11.4V9.4l1-1.6 1 1.6v2z" />
        <path d="M8.9 11.4v-1.2l.7-1 .7 1v1.2z" />
        <path d="M19.7 11.4v-1.2l.7-1 .7 1v1.2z" />
      </g>
    </svg>
  );
}

export function FlagGB({ className }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 60 30" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <clipPath id={`s${id}`}><path d="M0,0 v30 h60 v-30 z" /></clipPath>
      <clipPath id={`t${id}`}><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></clipPath>
      <g clipPath={`url(#s${id})`}>
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#t${id})`} stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

export const FLAGS = { th: FlagTH, km: FlagKH, en: FlagGB };

export function Flag({ code, className = 'h-4 w-6' }) {
  const F = FLAGS[code] || FlagTH;
  return (
    <span className={`inline-block overflow-hidden rounded-[4px] ring-1 ring-black/10 shadow-sm ${className}`}>
      <F className="h-full w-full" />
    </span>
  );
}
