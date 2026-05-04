export function redactUrl(url: string): string {
  return url
    .replace(/\/(v[23])\/[a-zA-Z0-9_-]+/g, '/$1/***REDACTED***')
    .replace(/([?&])(apikey|api_key|key)=[^&]+/gi, '$1$2=***REDACTED***');
}
