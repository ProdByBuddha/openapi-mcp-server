export function connectSse(url: string, onMessage: (data: any) => void) {
  const es = new EventSource(url);
  es.onmessage = (evt) => {
    try { onMessage(JSON.parse(evt.data)); }
    catch { onMessage(evt.data); }
  };
  return es;
}
