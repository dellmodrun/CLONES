const BASE_URL = 'https://api.jup.ag/swap/v2';

export class JupiterSwap {
  constructor(apiKey = '', fetcher = fetch) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  headers(json = false) {
    return {
      ...(this.apiKey ? { 'x-api-key': this.apiKey } : {}),
      ...(json ? { 'content-type': 'application/json' } : {}),
    };
  }

  async order({ inputMint, outputMint, amount, taker, slippageBps }) {
    const query = new URLSearchParams({ inputMint, outputMint, amount: String(amount), taker });
    if (slippageBps) query.set('slippageBps', String(slippageBps));
    const response = await this.fetcher(`${BASE_URL}/order?${query}`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json();
    if (!response.ok || payload.error || !payload.transaction) {
      throw new Error(payload.errorMessage || payload.error || `Jupiter order failed (${response.status})`);
    }
    return payload;
  }

  async execute({ signedTransaction, requestId }) {
    const response = await this.fetcher(`${BASE_URL}/execute`, {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({ signedTransaction, requestId }),
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json();
    if (!response.ok || payload.error || (payload.status && payload.status !== 'Success')) {
      throw new Error(payload.errorMessage || payload.error || `Jupiter execution failed (${response.status})`);
    }
    return payload;
  }
}
