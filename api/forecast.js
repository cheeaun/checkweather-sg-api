const API_KEY = process.env.API_KEY;

const API_URLS = {
  2: 'https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast',
  24: 'https://api-open.data.gov.sg/v2/real-time/api/twenty-four-hr-forecast',
};

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const hr = parseInt(url.searchParams.get('hr')) || 2;
    const apiUrl = API_URLS[hr];

    if (!apiUrl) {
      return new Response(JSON.stringify({ error: 'Invalid hr value. Supported: 2, 24' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      });
    }

    const fetchUrl = new URL(apiUrl);
    const dateParam = url.searchParams.get('date');
    if (dateParam) fetchUrl.searchParams.set('date', dateParam);

    console.log(`➡️ ${fetchUrl}${API_KEY ? ' (with API key)' : ''}`);

    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'checkweather-sg-api',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const body = await response.json();

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120, s-maxage=120',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.stack || e }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  }
}
