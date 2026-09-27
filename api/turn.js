// Vercel: выдаёт временные пароли резервного канала TURN (Cloudflare Realtime).
// В настройках проекта Vercel задайте переменные TURN_KEY_ID и TURN_KEY_API_TOKEN.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const id = process.env.TURN_KEY_ID, token = process.env.TURN_KEY_API_TOKEN;
  if (!id || !token) return res.status(200).json({ iceServers: [], relay: false, reason: 'not configured' });
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 6 * 3600 })
    });
    if (!r.ok) return res.status(200).json({ iceServers: [], relay: false, reason: 'cloudflare ' + r.status });
    const j = await r.json();
    const list = Array.isArray(j.iceServers) ? j.iceServers : j.iceServers ? [j.iceServers] : [];
    // оставляем только записи с логином: это и есть TURN, STUN у игры свой
    const turn = list.filter(s => s && s.username && [].concat(s.urls || []).some(u => /^turns?:/.test(u)));
    return res.status(200).json({ iceServers: turn, relay: turn.length > 0 });
  } catch (e) {
    return res.status(200).json({ iceServers: [], relay: false, reason: 'error' });
  }
};
