export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';
export const localDay = () => {
  const d = new Date();
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};
export async function request(path, { token, method='GET', body }={}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try { response = await fetch(API_URL + path, { method, headers, body: body===undefined?undefined:JSON.stringify(body) }); }
  catch { throw new Error('Не удалось связаться с API. Проверьте EXPO_PUBLIC_API_URL и Wi-Fi.'); }
  if (response.status === 204) return null;
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data?.error?.message || 'Ошибка сервера');
  return data;
}
