'use client';
import { AlertTriangle, Archive, CheckCircle2, CircleDashed, Clock, HelpCircle, PackageX, Wrench, XCircle } from 'lucide-react';
import { Badge } from './ui';
import { useI18n } from './providers';
import { today } from '@/lib/format';

export const ASSET_STATUS = {
  active: { tone: 'green', icon: CheckCircle2, color: '#10b981' },
  repair: { tone: 'amber', icon: Wrench, color: '#f59e0b' },
  broken: { tone: 'red', icon: XCircle, color: '#ef4444' },
  spare: { tone: 'blue', icon: Archive, color: '#0ea5e9' },
  lost: { tone: 'violet', icon: HelpCircle, color: '#8b5cf6' },
  disposed: { tone: 'gray', icon: PackageX, color: '#94a3b8' },
};
export const REPAIR_STATUS = {
  open: { tone: 'red', icon: AlertTriangle },
  in_progress: { tone: 'amber', icon: Wrench },
  waiting_parts: { tone: 'blue', icon: Clock },
  done: { tone: 'green', icon: CheckCircle2 },
  cancelled: { tone: 'gray', icon: XCircle },
};
export const PRIORITY = {
  low: { tone: 'slate' }, normal: { tone: 'blue' }, high: { tone: 'orange' }, urgent: { tone: 'red' },
};
export const RESULT = {
  pass: { tone: 'green', icon: CheckCircle2 },
  issue: { tone: 'amber', icon: AlertTriangle },
  fail: { tone: 'red', icon: XCircle },
};

export function AssetStatusBadge({ status }) {
  const { t } = useI18n();
  const s = ASSET_STATUS[status] || { tone: 'slate', icon: CircleDashed };
  return <Badge tone={s.tone} dot>{t(`status.${status}`)}</Badge>;
}
export function RepairStatusBadge({ status }) {
  const { t } = useI18n();
  const s = REPAIR_STATUS[status] || { tone: 'slate' };
  return <Badge tone={s.tone} icon={s.icon}>{t(`repairStatus.${status}`)}</Badge>;
}
export function PriorityBadge({ priority }) {
  const { t } = useI18n();
  return <Badge tone={(PRIORITY[priority] || PRIORITY.normal).tone} dot>{t(`priority.${priority}`)}</Badge>;
}
export function ResultBadge({ result }) {
  const { t } = useI18n();
  const s = RESULT[result] || RESULT.pass;
  return <Badge tone={s.tone} icon={s.icon}>{t(`result.${result}`)}</Badge>;
}

/** Days-left pill for inspections */
export function DueBadge({ days }) {
  const { t } = useI18n();
  if (days === null || days === undefined) return <Badge>-</Badge>;
  const d = Number(days);
  if (d < 0) return <Badge tone="red" dot>{t('schedule.overdue_by', { n: Math.abs(d) })}</Badge>;
  if (d === 0) return <Badge tone="amber" dot>{t('schedule.today')}</Badge>;
  if (d <= 30) return <Badge tone="amber">{t('schedule.in_days', { n: d })}</Badge>;
  return <Badge tone="green">{t('schedule.in_days', { n: d })}</Badge>;
}

/** Whole days from today (Cambodia time) until a YYYY-MM-DD date */
export function daysUntil(date) {
  if (!date) return null;
  const a = Date.parse(String(date).slice(0, 10) + 'T00:00:00Z');
  const b = Date.parse(today() + 'T00:00:00Z');
  return Math.round((a - b) / 86400000);
}
