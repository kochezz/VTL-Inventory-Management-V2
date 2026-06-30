import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

export default function ScanScreen({ punchType, onIdentify, onUseEmail, onBack }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const [cameraError,  setCameraError]  = useState('');
  const [identifying,  setIdentifying]  = useState(false);
  const [identifyError, setIdentifyError] = useState('');

  useEffect(() => {
    let stream = null;
    let rafId  = null;
    let active = true;

    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d', { willReadFrequently: true });

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        video.srcObject = stream;
        await video.play();
        loop();
      } catch (err) {
        if (active) setCameraError(err.message);
      }
    }

    function loop() {
      if (!active) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code && active) {
          active = false;
          if (stream) stream.getTracks().forEach(t => t.stop());
          handleScan(code.data);
          return;
        }
      }
      rafId = requestAnimationFrame(loop);
    }

    startCamera();

    return () => {
      active = false;
      if (rafId)  cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  async function handleScan(data) {
    setIdentifying(true);
    setIdentifyError('');
    try {
      await onIdentify({ badge_token: data });
      // onIdentify navigates away on success; component is unmounted
    } catch (err) {
      setIdentifyError(err.message || 'Badge not recognised. Try your email instead.');
      setIdentifying(false);
    }
  }

  return (
    <div className="screen">
      <h1 className="screen-title">
        {punchType === 'clock_in' ? 'Clock In' : 'Clock Out'}
      </h1>
      <p className="screen-subtitle">Scan your badge QR code</p>

      {cameraError ? (
        <div className="error-card">Camera unavailable: {cameraError}</div>
      ) : (
        <div className="camera-wrap">
          <video ref={videoRef} playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
          {identifying && (
            <div className="countdown-overlay" style={{ fontSize: 28 }}>
              Looking up...
            </div>
          )}
        </div>
      )}

      {identifyError && <div className="error-card">{identifyError}</div>}

      <button className="link-btn" onClick={onUseEmail}>
        Use email instead
      </button>

      <button className="btn btn-ghost" onClick={onBack}>
        Cancel
      </button>
    </div>
  );
}
