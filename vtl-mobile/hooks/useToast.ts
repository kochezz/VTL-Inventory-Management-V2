import { useState, useCallback, useRef } from 'react';
import { ToastType } from '../components/Toast';

export function useToast() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('success');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, t: ToastType = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(msg);
    setType(t);
    setVisible(true);
    timer.current = setTimeout(() => setVisible(false), 3000);
  }, []);

  return { visible, message, type, show };
}
