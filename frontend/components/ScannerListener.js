'use client';
import { usePathname, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { parseScan, useScannerInput } from '@/lib/scanner';
import { useI18n } from './providers';

/**
 * App-wide Bluetooth / USB scanner support: scanning an Asset PRC label on any page opens its link
 * (/a/CODE) straight away — the same page the phone camera opens.
 * The Scan page handles scans itself (shows the result card), so it is skipped here.
 */
export default function ScannerListener() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname() || '';
  const enabled = !pathname.startsWith('/scan') && !pathname.startsWith('/login');

  useScannerInput((text) => {
    const r = parseScan(text);
    if (r.code) {
      if (navigator.vibrate) navigator.vibrate(60);
      router.push(`/a/${encodeURIComponent(r.code)}`);
    } else if (r.external) {
      // a scanner can read any QR code; never jump to unknown websites
      toast.error(t('scan.not_assetqr'));
    }
  }, { enabled });

  return null;
}
