const BASE_URL = 'https://api.jup.ag/tokens/v2';

export class JupiterTokens {
  constructor(apiKey = '', fetchImpl = fetch) {
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
  }

  async request(path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await this.fetch(`${BASE_URL}${path}`, {
        headers: this.apiKey ? { 'x-api-key': this.apiKey } : {},
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || body.message || `Jupiter Tokens returned ${response.status}`);
      if (!Array.isArray(body)) throw new Error('Jupiter Tokens returned an invalid response');
      return body;
    } finally {
      clearTimeout(timeout);
    }
  }

  recent() {
    return this.request('/recent');
  }

  topOrganic(interval = '5m', limit = 50) {
    const safeInterval = ['5m', '1h', '6h', '24h'].includes(interval) ? interval : '5m';
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    return this.request(`/toporganicscore/${safeInterval}?limit=${safeLimit}`);
  }
}
