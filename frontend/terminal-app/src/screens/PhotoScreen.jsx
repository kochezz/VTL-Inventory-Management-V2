import { useEffect, useRef, useState } from 'react';
import { punch } from '../api.js';
import { queuePunch } from '../db.js';

// Business error codes that must route back to the PIN screen rather than
// triggering the offline queue. Network failures and server 500s are queued.
const BUSINESS_CODES = new Set(['INVALID_PIN', 'PIN_LOCKED', 'PIN_MUST_CHANGE']);
const COUNTDOWN_SECS = 3;

export default function PhotoScreen({ worker, punchType, pin, deviceCode, onResult, onBack }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const [cameraError, setCameraError] = useState('');
  const [countdown,   setCountdown]   = useState(COUNTDOWN_SECS);
  const [phase, setPhase] = useState('starting'); // starting | counting | submitting

  useEffect(() => {
    let stream   = null;
    let timerId  = null;
    let active   = true;
    const video  = videoRef.current;
    const canvas = canvasRef.current;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
          audio: false,
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        video.srcObject = stream;
        await video.play();
        if (active) {
          setPhase('counting');
          startCountdown();
        }
      } catch (err) {
        if (active) setCameraError(err.message);
      }
    }

    function startCountdown() {
      let secs = COUNTDOWN_SECS;
      setCountdown(secs);
      timerId = setInterval(() => {
        if (!active) return;
        secs -= 1;
        setCountdown(secs);
        if (secs <= 0) {
          clearInterval(timerId);
          capture();
        }
      }, 1000);
    }

    function capture() {
      canvas.width  = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 320, 240);
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.5);
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (active) {
        setPhase('submitting');
        submitPunch(photoDataUrl);
      }
    }

    async function submitPunch(photoDataUrl) {
      const client_uuid = crypto.randomUUID();
      const punched_at  = new Date().toISOString();
      const payload = {
        device_code:     deviceCode,
        badge_token:     worker.badge_token,
        email_localpart: worker.email_localpart,
        pin,
        punch_type:      punchType,
        photo_ref:       photoDataUrl,
        client_uuid,
        punched_at,
      };

      try {
        const result = await punch(payload);
        if (active) onResult(result, null);
      } catch (err) {
        if (!active) return;
        if (BUSINESS_CODES.has(err.code)) {
          // PIN problem — let App route to PIN or CHANGE_PIN screen
          onResult(null, err);
        } else {
          // Network / server fault — queue offline; NEVER lose the punch
          try {
            await queuePunch({
              ...payload,
              user_id:      worker.user_id,
              entry_method: worker.badge_token ? 'qr' : 'email',
            });
          } catch (_) {}
          onResult({ queued: true, client_uuid }, null);
        }
      }
    }

    startCamera();

    return () => {
      active = false;
      if (timerId) clearInterval(timerId);
      if (stream)  stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  if (cameraError) {
    return (
      <div className="screen">
        <div className="error-card">Camera unavailable: {cameraError}</div>
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1 className="screen-title">
        {phase === 'submitting' ? 'Recording...' : 'Look at the camera'}
      </h1>

      <div className="camera-wrap">
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ display: phase === 'submitting' ? 'none' : 'block' }}
        />
        <canvas
          ref={canvasRef}
          style={{ display: phase === 'submitting' ? 'block' : 'none' }}
        />
        {phase === 'counting' && countdown > 0 && (
          <div className="countdown-overlay">{countdown}</div>
        )}
        {phase === 'submitting' && (
          <div className="countdown-overlay" style={{ fontSize: 30 }}>
            Submitting...
          </div>
        )}
      </div>

      {phase === 'starting' && (
        <p className="screen-subtitle">Starting camera...</p>
      )}
    </div>
  );
}
