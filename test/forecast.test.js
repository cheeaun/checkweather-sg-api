import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

global.fetch = mock.fn();
global.console = { ...console, log: mock.fn(), error: mock.fn() };

describe('Forecast API', () => {
  beforeEach(() => {
    // recreate mock to clear call history
    global.fetch = mock.fn();
  });

  it('should return 400 for invalid hr value', async () => {
    const { GET } = await import('../api/forecast.js');
    const request = new Request('http://localhost/forecast?hr=99');
    const response = await GET(request);

    assert.strictEqual(response.status, 400);
    const data = await response.json();
    assert.ok(data.error.includes('Invalid hr'));
  });

  it('should fetch 2-hour forecast by default', async () => {
    const mockData = { code: 0, data: { items: [] } };
    global.fetch.mock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockData),
      })
    );

    const { GET } = await import('../api/forecast.js');
    const request = new Request('http://localhost/forecast');
    const response = await GET(request);

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.deepStrictEqual(data, mockData);

    const calledUrl = String(global.fetch.mock.calls[0].arguments[0]);
    assert.ok(calledUrl.includes('two-hr-forecast'));
  });

  it('should fetch 24-hour forecast when hr=24', async () => {
    const mockData = { code: 0, data: { records: [] } };
    global.fetch.mock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockData),
      })
    );

    const { GET } = await import('../api/forecast.js');
    const request = new Request('http://localhost/forecast?hr=24');
    const response = await GET(request);

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.deepStrictEqual(data, mockData);

    const calledUrl = String(global.fetch.mock.calls[0].arguments[0]);
    assert.ok(calledUrl.includes('twenty-four-hr-forecast'));
  });

  it('should pass through date parameter', async () => {
    const mockData = { code: 0 };
    global.fetch.mock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockData),
      })
    );

    const { GET } = await import('../api/forecast.js');
    const request = new Request('http://localhost/forecast?date=2024-07-16');
    const response = await GET(request);

    assert.strictEqual(response.status, 200);
    const calledUrl = String(global.fetch.mock.calls[0].arguments[0]);
    assert.ok(calledUrl.includes('date=2024-07-16'));
  });

  it('should handle fetch errors gracefully', async () => {
    global.fetch.mock.mockImplementation(() =>
      Promise.reject(new Error('Network error'))
    );

    const { GET } = await import('../api/forecast.js');
    const request = new Request('http://localhost/forecast');
    const response = await GET(request);

    assert.strictEqual(response.status, 500);
    const data = await response.json();
    assert.ok(data.hasOwnProperty('error'));
  });

  it('should handle HTTP errors', async () => {
    global.fetch.mock.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 502,
      })
    );

    const { GET } = await import('../api/forecast.js');
    const request = new Request('http://localhost/forecast');
    const response = await GET(request);

    assert.strictEqual(response.status, 500);
    const data = await response.json();
    assert.ok(data.hasOwnProperty('error'));
  });
});
