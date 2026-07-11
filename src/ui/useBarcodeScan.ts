// Shared camera-based barcode scanning logic for BarcodeAddModal and
// WeighLabelScanModal (src/ui/App.tsx). Two very different mechanisms
// depending on platform:
//
// - Native Android: uses @capacitor-mlkit/barcode-scanning's `scan()` —
//   a ready-made, full-screen native camera UI (Google Play Services'
//   own barcode scanning activity, not our WebView). This works
//   regardless of whether the page itself is loaded from a secure
//   context, which matters because the native app now live-loads the
//   LAN server directly over plain HTTP (see capacitor.config.ts) — a
//   context where the web APIs below are unavailable.
// - Browser (desktop/mobile, and previously also the native app before
//   it switched to live-loading): the browser's own getUserMedia +
//   BarcodeDetector APIs, which DO require a secure context — fine in
//   an ordinary HTTPS-or-localhost browser tab.
//
// Callers only ever see `onDetected`/`onError` — they don't need to know
// which path ran. On native there's no embedded video to render (the
// scan UI is a separate full-screen native activity), so `videoRef` is
// simply unused in that case; callers should skip rendering the <video>
// element when `isNative` is true.
import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { BarcodeScanner, BarcodeFormat } from "@capacitor-mlkit/barcode-scanning";

export const WEB_BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];

const NATIVE_BARCODE_FORMATS = [
  BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE,
  BarcodeFormat.Code128, BarcodeFormat.Code39, BarcodeFormat.Itf, BarcodeFormat.QrCode
];

interface UseBarcodeScanOptions {
  // Whether the scan step is currently the active/visible one — scanning
  // only starts while true, and any in-flight attempt is abandoned
  // (result ignored) once it flips back to false.
  active: boolean;
  onDetected: (code: string) => void;
  onError: (message: string) => void;
}

export function useBarcodeScan({ active, onDetected, onError }: UseBarcodeScanOptions) {
  const isNative = Capacitor.isNativePlatform();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraSupportedWeb = typeof navigator !== "undefined" && !!navigator.mediaDevices && "BarcodeDetector" in window;
  const cameraSupported = isNative || cameraSupportedWeb;

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!active) return;

    if (isNative) {
      let cancelled = false;
      (async () => {
        try {
          // On devices without the Google Barcode Scanner module yet
          // (rare — usually only a factory-fresh device that's never
          // used any ML Kit-backed app), kick off the download and ask
          // the user to retry rather than hanging on a `scan()` call
          // that would otherwise fail outright.
          const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
          if (!available) {
            await BarcodeScanner.installGoogleBarcodeScannerModule();
            if (!cancelled) onError("Preparing the scanner for first use — try again in a few seconds, or enter the barcode manually.");
            return;
          }
          const { barcodes } = await BarcodeScanner.scan({ formats: NATIVE_BARCODE_FORMATS });
          if (cancelled) return;
          const code = barcodes[0]?.rawValue ?? barcodes[0]?.displayValue;
          if (code) onDetected(code);
          else onError("No barcode detected — try again or enter it manually.");
        } catch {
          if (!cancelled) onError("Couldn't open the camera — check permissions, or enter the barcode manually.");
        }
      })();
      return () => { cancelled = true; };
    }

    if (!cameraSupportedWeb) { onError("Camera scanning isn't supported on this device — enter the barcode manually instead."); return; }

    let cancelled = false;
    let intervalId: number;
    const detector = new BarcodeDetector({ formats: WEB_BARCODE_FORMATS });

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play(); }
        intervalId = window.setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0) {
              window.clearInterval(intervalId);
              stopCamera();
              onDetected(results[0].rawValue);
            }
          } catch { /* transient decode failure — retried on the next tick */ }
        }, 300);
      })
      .catch(() => { if (!cancelled) onError("Couldn't access the camera — check permissions, or enter the barcode manually."); });

    return () => { cancelled = true; window.clearInterval(intervalId); stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return { videoRef, isNative, cameraSupported };
}
