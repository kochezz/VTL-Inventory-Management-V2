'use client';

import React, { useState } from 'react';
import BarcodeScanner from '@/components/barcode/BarcodeScanner';

interface ScanRecord {
  code: string;
  format: string;
  timestamp: string;
}

export default function TestScannerPage() {
  const [scannedCode, setScannedCode] = useState<string>('');
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const handleScan = (code: string, format: string) => {
    console.log('Scanned:', code, format);
    setScannedCode(code);

    setScanHistory((prev) => [
      { code, format, timestamp: new Date().toLocaleTimeString() },
      ...prev.slice(0, 9),
    ]);
  };

  const handleError = (error: Error) => {
    console.error('Scanner error:', error);
    alert(`Scanner Error: ${error.message}`);
  };

  const requestCameraPermission = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error('Camera API not supported in this browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });

    stream.getTracks().forEach((t) => t.stop());
  };

  const handleToggleScanner = async () => {
    try {
      if (!isScanning) {
        // IMPORTANT: ask permission as a direct result of a user click
        await requestCameraPermission();
        setIsScanning(true);
      } else {
        setIsScanning(false);
      }
    } catch (e) {
      const err = e as Error;
      alert(`Camera permission error: ${err.message}`);
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Barcode Scanner Test</h1>
          <p className="text-gray-600">Test the ZXing barcode scanner component</p>
        </div>

        {/* Scanner Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Scanner</h2>

          <BarcodeScanner
            onScan={handleScan}
            onError={handleError}
            continuousMode={true}
            showOverlay={true}
            isActive={isScanning}
            preferredCamera="back"
          />

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleToggleScanner}
              className={`px-6 py-2 rounded-lg font-medium transition ${
                isScanning ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
              type="button"
            >
              {isScanning ? 'Stop Scanner' : 'Start Scanner'}
            </button>

            <button
              onClick={() => {
                setScannedCode('');
                setScanHistory([]);
              }}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
              type="button"
            >
              Clear History
            </button>
          </div>

          <div className="mt-3 text-sm text-gray-600">
            Tip (Pixel 7): open this link in <strong>Chrome</strong> (not inside WhatsApp/Instagram in-app browser),
            and ensure site permissions allow camera.
          </div>
        </div>

        {/* Last Scanned Code */}
        {scannedCode && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-green-800 mb-2">Last Scanned Code</h3>
            <div className="bg-white p-4 rounded border border-green-300">
              <code className="text-2xl font-mono text-gray-900">{scannedCode}</code>
            </div>
          </div>
        )}

        {/* Scan History */}
        {scanHistory.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Scan History ({scanHistory.length})</h3>
            <div className="space-y-2">
              {scanHistory.map((scan, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-1">
                    <code className="text-sm font-mono text-gray-900">{scan.code}</code>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">{scan.format}</span>
                    <span>{scan.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-3">📷 Scanner Instructions</h3>
          <ul className="space-y-2 text-blue-900">
            <li className="flex items-start gap-2">
              <span className="font-bold">1.</span>
              <span>Click &quot;Start Scanner&quot; to activate the camera</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">2.</span>
              <span>Allow camera access when prompted by Chrome</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">3.</span>
              <span>Point the camera at a barcode (Code 128, QR code, etc.)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">4.</span>
              <span>Hold the barcode steady 6–12 inches from the camera</span>
            </li>
          </ul>

          <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded">
            <p className="text-sm text-yellow-900">
              ⚠️ <strong>HTTPS Required:</strong> Camera access requires HTTPS. Ngrok is perfect for this.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
