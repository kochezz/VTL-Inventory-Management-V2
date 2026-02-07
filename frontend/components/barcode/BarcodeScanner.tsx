// =====================================================
// VILAGIO BARCODE SCANNER COMPONENT
// File: BarcodeScanner.tsx
// Location: frontend/components/barcode/BarcodeScanner.tsx
// Purpose: Camera-based barcode scanning using ZXing
// =====================================================

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, NotFoundException, Result } from '@zxing/library';
import { Camera, Zap, ZapOff, RotateCw, CheckCircle, AlertCircle } from 'lucide-react';

interface BarcodeScannerProps {
  // Callback when barcode is successfully scanned
  onScan: (result: string, format: string) => void;

  // Callback when scanner encounters an error
  onError?: (error: Error) => void;

  // Whether to allow continuous scanning or stop after first scan
  continuousMode?: boolean;

  // Delay between scans in continuous mode (ms)
  scanDelay?: number;

  // Initial camera (front/back)
  preferredCamera?: 'front' | 'back';

  // Scanner active state from parent
  isActive?: boolean;

  // Custom styling
  className?: string;

  // Show scan overlay guides
  showOverlay?: boolean;

  // Supported barcode formats
  formats?: string[];
}

interface ScanStatus {
  type: 'idle' | 'scanning' | 'success' | 'error';
  message: string;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScan,
  onError,
  continuousMode = false,
  scanDelay = 500,
  preferredCamera = 'back',
  isActive = true,
  className = '',
  showOverlay = true,
  formats = ['CODE_128', 'CODE_39', 'QR_CODE', 'DATA_MATRIX', 'EAN_13', 'UPC_A'],
}) => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  // State
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  const [scanStatus, setScanStatus] = useState<ScanStatus>({
    type: 'idle',
    message: 'Tap "Start Scanner" to begin',
  });

  const [lastScan, setLastScan] = useState<{ code: string; timestamp: number } | null>(null);
  const [scanCount, setScanCount] = useState(0);

  /**
   * IMPORTANT (Android/mobile):
   * Many browsers will not return camera devices (or device labels) until
   * camera permission is granted at least once.
   */
  const ensureCameraPermission = useCallback(async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error('Camera API not supported in this browser.');
    }

    // Request permission using facingMode (more reliable on mobile)
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: preferredCamera === 'back' ? 'environment' : 'user' },
      audio: false,
    });

    // Immediately stop – we only needed permission + to unlock device enumeration
    stream.getTracks().forEach((t) => t.stop());
    setHasPermission(true);
  }, [preferredCamera]);

  const pickBestDeviceId = useCallback(
    (videoDevices: MediaDeviceInfo[]) => {
      if (!videoDevices.length) return '';

      // Labels are often available only after permission
      const label = (d: MediaDeviceInfo) => (d.label || '').toLowerCase();

      const back = videoDevices.find(
        (d) =>
          label(d).includes('back') ||
          label(d).includes('rear') ||
          label(d).includes('environment') ||
          label(d).includes('wide') // sometimes on Android
      );

      const front = videoDevices.find((d) => label(d).includes('front') || label(d).includes('user'));

      if (preferredCamera === 'back' && back) return back.deviceId;
      if (preferredCamera === 'front' && front) return front.deviceId;

      // fallback
      return videoDevices[0].deviceId;
    },
    [preferredCamera]
  );

  const enumerateDevices = useCallback(async () => {
    if (!readerRef.current) return;

    const videoDevices = await readerRef.current.listVideoInputDevices();
    setDevices(videoDevices);

    const best = pickBestDeviceId(videoDevices);
    if (best) setSelectedDeviceId(best);

    return videoDevices;
  }, [pickBestDeviceId]);

  /**
   * Initialize reader
   */
  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader();

    return () => {
      stopScanning();
      readerRef.current?.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * When parent activates scanner:
   * - ensure permission (if not already)
   * - enumerate cameras
   * - start scanning
   *
   * NOTE: permission must be triggered by a user gesture.
   * The parent page (Start button) now calls permission first too,
   * but we keep this as a safety net.
   */
  useEffect(() => {
    const run = async () => {
      if (!isActive) {
        if (isScanning) stopScanning();
        return;
      }

      // active requested
      if (isScanning) return;

      try {
        if (!hasPermission) {
          // This may still work if isActive is toggled via a click
          await ensureCameraPermission();
        }

        await enumerateDevices();
        await startScanning();
      } catch (err) {
        const e = err as Error;
        console.error('Scanner activation error:', e);
        setScanStatus({ type: 'error', message: e.message || 'Cannot access camera' });
        setIsScanning(false);
        onError?.(e);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  /**
   * Handle successful scan
   */
  const handleScanSuccess = useCallback(
    (result: Result) => {
      const code = result.getText();
      const format = result.getBarcodeFormat().toString();
      const now = Date.now();

      // Prevent duplicate scans within scanDelay
      if (lastScan && code === lastScan.code && now - lastScan.timestamp < scanDelay) return;

      setLastScan({ code, timestamp: now });
      setScanCount((prev) => prev + 1);

      setScanStatus({ type: 'success', message: `Scanned: ${code}` });

      // Vibrate (Android supported)
      if ('vibrate' in navigator) navigator.vibrate(200);

      onScan(code, format);

      if (!continuousMode) {
        stopScanning();
      } else {
        setTimeout(() => {
          setScanStatus({ type: 'scanning', message: 'Ready for next scan' });
        }, 800);
      }
    },
    [continuousMode, lastScan, onScan, scanDelay]
  );

  /**
   * Start scanning
   * - Prefer decodeFromVideoDevice if we have a deviceId
   * - Otherwise fallback to decodeFromConstraints (more reliable on mobile)
   */
  const startScanning = async () => {
    if (!readerRef.current || !videoRef.current) return;

    try {
      setIsScanning(true);
      setScanStatus({ type: 'scanning', message: 'Scanning...' });

      const callback = (result: Result | undefined, error: unknown) => {
        if (result) handleScanSuccess(result);
        if (error && !(error instanceof NotFoundException)) {
          console.error('Scan error:', error);
        }
      };

      if (selectedDeviceId) {
        await readerRef.current.decodeFromVideoDevice(selectedDeviceId, videoRef.current, callback);
      } else {
        // Fallback for cases where enumerateDevices yields nothing
        await readerRef.current.decodeFromConstraints(
          { video: { facingMode: preferredCamera === 'back' ? 'environment' : 'user' } },
          videoRef.current,
          callback
        );
      }
    } catch (error) {
      const e = error as Error;
      console.error('Error starting scanner:', e);
      setScanStatus({ type: 'error', message: e.message || 'Failed to start camera' });
      setIsScanning(false);
      onError?.(e);
    }
  };

  /**
   * Stop scanning
   */
  const stopScanning = () => {
    readerRef.current?.reset();
    setIsScanning(false);
    setTorchOn(false);
    setScanStatus({ type: 'idle', message: 'Scanner stopped' });
  };

  /**
   * Switch camera
   */
  const switchCamera = async () => {
    if (devices.length <= 1) return;

    const currentIndex = devices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;

    stopScanning();
    setSelectedDeviceId(devices[nextIndex].deviceId);

    // Restart immediately if active
    if (isActive) {
      // Ensure it restarts after state updates
      setTimeout(() => startScanning(), 0);
    }
  };

  /**
   * Toggle torch (works on many Android devices if supported)
   */
  const toggleTorch = async () => {
    try {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      if (!stream) return;

      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;

      if (!capabilities?.torch) return;

      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as any],
      });

      setTorchOn(!torchOn);
    } catch (error) {
      console.error('Error toggling torch:', error);
    }
  };

  const getStatusColor = () => {
    switch (scanStatus.type) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'scanning':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (scanStatus.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'scanning':
        return <Camera className="w-5 h-5 text-blue-600 animate-pulse" />;
      default:
        return <Camera className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className={`barcode-scanner-container relative ${className}`}>
      {/* Video Preview */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ maxHeight: '400px' }}
          playsInline
          muted
          autoPlay
        />

        {/* Scan Overlay */}
        {showOverlay && isScanning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="border-4 border-green-500 rounded-lg w-64 h-40 shadow-lg">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-green-500" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-green-500" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-green-500" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-green-500" />
            </div>
          </div>
        )}

        {/* Controls Overlay */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4">
          {/* Switch Camera */}
          {devices.length > 1 && (
            <button
              onClick={switchCamera}
              className="bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition"
              title="Switch Camera"
              type="button"
            >
              <RotateCw className="w-5 h-5 text-gray-700" />
            </button>
          )}

          {/* Toggle Torch */}
          <button
            onClick={toggleTorch}
            className={`bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition ${
              torchOn ? 'ring-2 ring-yellow-400' : ''
            }`}
            title="Toggle Flashlight"
            type="button"
          >
            {torchOn ? <Zap className="w-5 h-5 text-yellow-600" /> : <ZapOff className="w-5 h-5 text-gray-700" />}
          </button>

          {/* Stop/Start Scanner */}
          <button
            onClick={isScanning ? stopScanning : startScanning}
            className={`px-4 py-2 rounded-full shadow-lg font-medium transition ${
              isScanning ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
            type="button"
          >
            {isScanning ? 'Stop' : 'Start'} Scan
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="mt-4 flex items-center justify-between bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className={`text-sm font-medium ${getStatusColor()}`}>{scanStatus.message}</span>
        </div>

        {continuousMode && scanCount > 0 && (
          <div className="text-sm text-gray-600">
            Scans: <span className="font-semibold">{scanCount}</span>
          </div>
        )}
      </div>

      {/* Camera Selection */}
      {devices.length > 1 && (
        <div className="mt-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Camera</label>
          <select
            value={selectedDeviceId}
            onChange={(e) => {
              stopScanning();
              setSelectedDeviceId(e.target.value);

              // restart if active
              if (isActive) setTimeout(() => startScanning(), 0);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.slice(0, 8)}...`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Last Scan Info */}
      {lastScan && (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
          <span className="font-medium">Last scan:</span>{' '}
          <code className="bg-white px-2 py-1 rounded">{lastScan.code}</code>
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;
