'use client';
import { useEffect, useRef } from 'react';

/** Per-device scanning preferences */
export const CAMERA_KEY = 'aqr_camera_enabled'; // '0' = camera OFF (use a Bluetooth / USB scanner instead)

/**
 * What a scanned value means:
 *   Asset PRC label link (…/a/CODE, from any host the labels were printed with) → { code }
 *   plain asset code / serial number                                       → { code }
 *   any other web link                                                     → { external: url }  (never opened)
 */
export function parseScan(text) {
  const s = String(text || '').trim();
  if (!s) return {};
  const m = s.match(/\/a\/([^/?#\s]+)/);
  if (m) return { code: decodeURIComponent(m[1]) };
  // Safety net for scans garbled by a keyboard-layout mismatch, e.g. "Https>&&192.168.55.156>3000&a&P504…":
  // if it looks like a link and contains an asset code (P504-602-04-26-0001), rebuild the code.
  if (/^h\W?t\W?t\W?p/i.test(s)) {
    const c = s.match(/([A-Z]\d{3})\W(\d{3})\W(\d{2})\W(\d{2})\W(\d{4})(?!\d)/i);
    if (c) return { code: `${c[1]}-${c[2]}-${c[3]}-${c[4]}-${c[5]}`.toUpperCase() };
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^www\./i.test(s)) return { external: s };
  return { code: s };
}

/**
 * Character a scanner meant to send, read from the PHYSICAL key (e.code) with a US layout.
 * Scanners send key positions; if the phone's keyboard language is not US English the browser's
 * e.key turns ":" into ">" and "/" into "&" etc. Using e.code avoids that completely.
 */
const US_SHIFT_DIGITS = ')!@#$%^&*(';
const US_KEYS = {
  Minus: ['-', '_'], Equal: ['=', '+'], BracketLeft: ['[', '{'], BracketRight: [']', '}'], Backslash: ['\\', '|'],
  Semicolon: [';', ':'], Quote: ["'", '"'], Backquote: ['`', '~'], Comma: [',', '<'], Period: ['.', '>'], Slash: ['/', '?'],
  Space: [' ', ' '], NumpadDecimal: ['.', '.'], NumpadSubtract: ['-', '-'], NumpadAdd: ['+', '+'], NumpadDivide: ['/', '/'], NumpadMultiply: ['*', '*'],
};
export function scannerChar(e) {
  const code = e.code || '';
  const shift = e.shiftKey;
  const key = e.key && e.key.length === 1 ? e.key : null;
  // the two characters this physical key can make on a US keyboard
  let pair = null;
  let m = code.match(/^Key([A-Z])$/);
  if (m) pair = [m[1].toLowerCase(), m[1]];
  else if ((m = code.match(/^Digit(\d)$/))) pair = [m[1], US_SHIFT_DIGITS[+m[1]]];
  else if ((m = code.match(/^Numpad(\d)$/))) pair = [m[1], m[1]];
  else if (US_KEYS[code]) pair = US_KEYS[code];
  if (!pair) return key; // no physical key info (some soft keyboards): use what the browser reports
  // the phone's character agrees with the key → trust it (keeps correct case even if Shift is not reported)
  if (key && (key === pair[0] || key === pair[1])) return key;
  // layout mismatch (e.g. "/" key reported as "&") → use the US character for that key
  if (/^Key/.test(code)) {
    const caps = typeof e.getModifierState === 'function' && e.getModifierState('CapsLock');
    return shift !== caps ? pair[1] : pair[0];
  }
  return pair[shift ? 1 : 0];
}

/** Elements with this attribute are scan boxes: the hook reads scanner keys even while they are focused */
export const SCAN_CAPTURE = 'data-scan-capture';
const isEditable = (el) => !!el && !el.hasAttribute?.(SCAN_CAPTURE) && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/**
 * Detects a hardware barcode / QR scanner (Bluetooth or USB, "keyboard mode").
 * A scanner types the whole code in a few milliseconds and ends with Enter (or Tab);
 * a person typing is far slower, so normal typing is never mistaken for a scan.
 * Keys typed into a text field are left alone (the field receives them as usual), except in scan boxes
 * marked with SCAN_CAPTURE. Characters are read from the physical key (see scannerChar), so the scan is
 * correct whatever keyboard language the phone is set to.
 */
export function useScannerInput(onScan, { enabled = true, minLength = 4, maxGap = 60 } = {}) {
  const cb = useRef(onScan);
  cb.current = onScan;
  useEffect(() => {
    if (!enabled) return undefined;
    let buf = '';
    let first = 0;
    let last = 0;
    const onKey = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (isEditable(e.target)) { buf = ''; return; }
      const now = performance.now();
      if (e.key === 'Enter' || e.key === 'Tab') {
        const fast = buf.length >= minLength && (now - first) / buf.length < maxGap;
        if (fast) { e.preventDefault(); e.stopPropagation(); const v = buf; buf = ''; cb.current(v); }
        buf = '';
        return;
      }
      const ch = scannerChar(e);
      if (!ch) return; // Shift, CapsLock, arrows …
      if (now - last > maxGap * 2) { buf = ''; first = now; }
      if (!buf) first = now;
      buf += ch;
      last = now;
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled, minLength, maxGap]);
}
