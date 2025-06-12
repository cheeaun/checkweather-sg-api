import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

// Simple global mocks
global.fetch = mock.fn();
global.console = { ...console, log: mock.fn(), time: mock.fn(), timeEnd: mock.fn(), error: mock.fn() };

describe('Rainarea API Tests', () => {
  beforeEach(() => {
    mock.reset();
  });

  it('should handle fetch errors gracefully', async () => {
    global.fetch.mock.mockImplementation(() => Promise.reject(new Error('Network error')));
    const { GET } = await import('../api/rainarea.js');

    const request = new Request('http://localhost/v1/rainarea?dt=202412151200');
    const response = await GET(request);

    assert.strictEqual(response.status, 500);
    assert.strictEqual(response.headers.get('Content-Type'), 'application/json');

    const data = await response.json();
    assert.ok(data.hasOwnProperty('error'));
  });

  it('should handle non-PNG content', async () => {
    global.fetch.mock.mockImplementation(() => Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: mock.fn(() => 'text/html') },
      arrayBuffer: mock.fn(() => Promise.resolve(Buffer.from('not-png').buffer))
    }));

    const { GET } = await import('../api/rainarea.js');
    const request = new Request('http://localhost/v1/rainarea?dt=202412151200');
    const response = await GET(request);

    assert.strictEqual(response.status, 500);
    assert.strictEqual(response.headers.get('Content-Type'), 'application/json');
  });

  it('should handle HTTP errors', async () => {
    global.fetch.mock.mockImplementation(() => Promise.resolve({
      ok: false,
      status: 404,
      headers: { get: mock.fn(() => 'text/html') }
    }));

    const { GET } = await import('../api/rainarea.js');
    const request = new Request('http://localhost/v1/rainarea?dt=202412151200');
    const response = await GET(request);

    assert.strictEqual(response.status, 500);
    assert.strictEqual(response.headers.get('Content-Type'), 'application/json');
  });

});
