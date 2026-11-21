import { ScanQrCode } from 'lucide-react';
import { cn } from './ui';

/**
 * QR scan icon with a glowing line sweeping over it.
 * Drop-in for a lucide icon: size and colour come from `className` (the line uses currentColor).
 * Pure CSS animation (tailwind `animate-scan-icon`, animates `top`): it keeps running even when the
 * device has "reduce motion" on (Windows Server default), and parent tap/hover transforms can't shift it.
 */
export default function ScanIcon({ className, strokeWidth = 2.2 }) {
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)}>
      <ScanQrCode className="h-full w-full" strokeWidth={strokeWidth} />
      <span aria-hidden
        className="pointer-events-none absolute inset-x-[18%] h-[2px] animate-scan-icon rounded-full bg-current shadow-[0_0_6px_1px_currentColor]" />
    </span>
  );
}
