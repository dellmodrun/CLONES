export class SolanaRpc {
  constructor(endpoint) {
    this.endpoint = endpoint;
    this.id = 0;
  }

  async call(method, params = []) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++this.id, method, params }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Solana RPC ${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message || 'Solana RPC error');
    return payload.result;
  }

  getBalance(address) {
    return this.call('getBalance', [address, { commitment: 'finalized' }]);
  }

  getTokenAccountsByOwner(owner, mint) {
    return this.call('getTokenAccountsByOwner', [
      owner,
      { mint },
      { commitment: 'finalized', encoding: 'jsonParsed' },
    ]);
  }
}
