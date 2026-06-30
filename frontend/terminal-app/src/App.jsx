import { useState, useEffect, useCallback } from 'react';
import { identify } from './api.js';
import SetupScreen from './screens/SetupScreen.jsx';
import IdleScreen from './screens/IdleScreen.jsx';
import ScanScreen from './screens/ScanScreen.jsx';
import EmailScreen from './screens/EmailScreen.jsx';
import PinScreen from './screens/PinScreen.jsx';
import ChangePinScreen from './screens/ChangePinScreen.jsx';
import PhotoScreen from './screens/PhotoScreen.jsx';
import ConfirmScreen from './screens/ConfirmScreen.jsx';
import SyncBanner from './components/SyncBanner.jsx';
import './App.css';

export default function App() {
  const [screen,       setScreen]       = useState(null);
  const [deviceCode,   setDeviceCode]   = useState('');
  const [punchType,    setPunchType]    = useState(null);
  const [worker,       setWorker]       = useState(null);
  const [pin,          setPin]          = useState('');
  const [pinError,     setPinError]     = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('vtl_device_code');
    setDeviceCode(saved || '');
    setScreen(saved ? 'IDLE' : 'SETUP');
  }, []);

  const handleSetup = (code) => {
    localStorage.setItem('vtl_device_code', code);
    setDeviceCode(code);
    setScreen('IDLE');
  };

  const handlePunchType = (type) => {
    setPunchType(type);
    setScreen('SCAN');
  };

  // Called by ScanScreen or EmailScreen — may throw; child catches and shows error
  const handleIdentify = async ({ badge_token, email_localpart }) => {
    const data = await identify({ badge_token, email_localpart });
    setWorker({ ...data, badge_token, email_localpart });
    setPinError(null);
    setPin('');
    setScreen('PIN');
  };

  const handlePinComplete = (enteredPin) => {
    setPin(enteredPin);
    setScreen('PHOTO');
  };

  // Called by PhotoScreen after punch attempt
  const handlePunchResult = (result, err) => {
    if (err) {
      if (err.code === 'PIN_MUST_CHANGE') {
        // Keep current pin in state — ChangePinScreen uses it as old_pin
        setScreen('CHANGE_PIN');
      } else {
        setPinError(err);
        setPin('');
        setScreen('PIN');
      }
      return;
    }
    setConfirmation({
      full_name:  worker.full_name,
      punch_type: punchType,
      punch_time: new Date(),
      queued:     result?.queued || false,
    });
    setScreen('CONFIRM');
  };

  // Called by ChangePinScreen after successful PIN change
  const handleChangePinDone = (newPin) => {
    setPin(newPin);
    setPinError(null);
    setScreen('PHOTO');
  };

  const resetToIdle = useCallback(() => {
    setPunchType(null);
    setWorker(null);
    setPin('');
    setPinError(null);
    setConfirmation(null);
    setScreen('IDLE');
  }, []);

  if (screen === null) return null;

  return (
    <div className="terminal-root">
      <SyncBanner deviceCode={deviceCode} />

      {screen === 'SETUP' && (
        <SetupScreen onSetup={handleSetup} />
      )}
      {screen === 'IDLE' && (
        <IdleScreen onPunchType={handlePunchType} />
      )}
      {screen === 'SCAN' && (
        <ScanScreen
          punchType={punchType}
          onIdentify={handleIdentify}
          onUseEmail={() => setScreen('EMAIL')}
          onBack={resetToIdle}
        />
      )}
      {screen === 'EMAIL' && (
        <EmailScreen
          punchType={punchType}
          onIdentify={handleIdentify}
          onBack={() => setScreen('SCAN')}
        />
      )}
      {screen === 'PIN' && (
        <PinScreen
          worker={worker}
          error={pinError}
          onComplete={handlePinComplete}
          onBack={resetToIdle}
        />
      )}
      {screen === 'CHANGE_PIN' && (
        <ChangePinScreen
          worker={worker}
          currentPin={pin}
          onDone={handleChangePinDone}
          onBack={resetToIdle}
        />
      )}
      {screen === 'PHOTO' && (
        <PhotoScreen
          worker={worker}
          punchType={punchType}
          pin={pin}
          deviceCode={deviceCode}
          onResult={handlePunchResult}
          onBack={() => { setPin(''); setScreen('PIN'); }}
        />
      )}
      {screen === 'CONFIRM' && (
        <ConfirmScreen
          confirmation={confirmation}
          onDone={resetToIdle}
        />
      )}
    </div>
  );
}
