import { next } from '@vercel/functions';

// Siteye girişte şifre sorar. Şifre kodda değil, Vercel'deki SITE_PASSWORD ortam değişkeninde durur.
// Kullanıcı adı önemsiz, sadece şifre kontrol edilir.
export const config = { matcher: '/(.*)' };

// Şifre uzunluğu ve karakterleri süreden sızmasın diye sabit sürede karşılaştırır.
function safeEqual(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] || 0) ^ (y[i] || 0);
  }
  return diff === 0;
}

function readPassword(header) {
  const [scheme, encoded] = header.split(' ');
  if (scheme !== 'Basic' || !encoded) return null;
  try {
    const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    return text.slice(text.indexOf(':') + 1);
  } catch (err) {
    return null;
  }
}

function deny(status, message, extraHeaders = {}) {
  return new Response(message, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

export default function middleware(request) {
  const password = process.env.SITE_PASSWORD;
  // Şifre ayarlanmamışsa site açık kalmasın.
  if (!password) return deny(503, 'Site kilitli: şifre ayarlanmamış.');

  const given = readPassword(request.headers.get('authorization') || '');
  if (given !== null && safeEqual(given, password)) return next();

  return deny(401, 'Giriş gerekli', {
    'WWW-Authenticate': 'Basic realm="Nisa", charset="UTF-8"',
  });
}
