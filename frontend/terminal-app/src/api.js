const API = import.meta.env.VITE_API_URL || '';

async function request(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || `HTTP ${res.status}`), data);
  return data;
}

export const identify       = (body) => request('/api/attendance/identify', body);
export const punch          = (body) => request('/api/attendance/punch', body);
export const syncPunches    = (body) => request('/api/attendance/sync', body);
export const changePinKiosk = (body) => request('/api/attendance/pin/change-kiosk', body);
