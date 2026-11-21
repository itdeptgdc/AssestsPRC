/* eslint-disable @next/next/no-img-element */
import { cn } from './ui';

/** Company logo tile (Poipet Resort & Casino) */
export function LogoMark({ className, size = 40 }) {
  return (
    <span
      className={cn('keep-light relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-[0_6px_18px_-6px_rgba(102,45,145,.55)] ring-1 ring-[#c9a24a]/50', className)}
      style={{ width: size, height: size }}
    >
      <img src="/icon-192.png" alt="Poipet Resort & Casino" className="h-full w-full object-contain p-[2px]" />
    </span>
  );
}

export default function Logo({ className, dark, title = 'Asset PRC', subtitle, size = 40, collapsed }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <LogoMark size={size} />
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className={cn('truncate text-[15px] font-bold', dark ? 'text-white' : 'text-slate-900')}>{title}</p>
          {subtitle && <p className={cn('truncate text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
