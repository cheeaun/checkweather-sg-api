// Simple in-memory cache - just store the previous request
let lastCache = null;

// Have to be X minutes in the past, else it's too recent and lack of data
export const datetime = () => {
  // Get current time
  const now = new Date();

  // Convert to Singapore timezone (UTC+8)
  const singaporeOffset = 8 * 60; // Singapore is UTC+8 in minutes
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000); // Convert to UTC
  const singaporeTime = new Date(utcTime + (singaporeOffset * 60000)); // Convert to Singapore time

  // Subtract 10 minutes and set seconds to 0
  const pastTime = new Date(singaporeTime.getTime() - 10 * 60 * 1000);
  pastTime.setSeconds(0, 0);

  // Format as ISO string and remove milliseconds and Z suffix
  return pastTime.toISOString().replace(/\..*$/, '');
};

const apiURLs = {
  temp_celcius: 'https://api-open.data.gov.sg/v2/real-time/api/air-temperature',
  rain_mm: 'https://api-open.data.gov.sg/v2/real-time/api/rainfall',
  relative_humidity: 'https://api-open.data.gov.sg/v2/real-time/api/relative-humidity',
  wind_direction: 'https://api-open.data.gov.sg/v2/real-time/api/wind-direction',
  wind_speed: 'https://api-open.data.gov.sg/v2/real-time/api/wind-speed',
};
const apiKeys = Object.keys(apiURLs);

const fetchData = async (url, dt) => {
  const fullUrl = `${url}?date_time=${dt}`;

  // Check if we have cached data for this exact request
  if (lastCache && lastCache.key === fullUrl) {
    console.log(`🥞 Cache hit: ${fullUrl}`);
    return lastCache.result;
  }

  console.log(`➡️ ${fullUrl}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

  try {
    const response = await fetch(fullUrl, {
      signal: controller.signal,
      redirect: 'manual', // Handle redirects manually (maxRedirects: 1 equivalent)
      headers: {
        'User-Agent': 'checkweather-sg-api'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const body = await response.json();
    const result = { body };

    // Cache this result
    lastCache = { key: fullUrl, result };

    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// id, lng, lat, temp_celcius, relative_humidity, rain_mm, wind_direction, wind_speed

const getObservations = async () => {
  const climateStations = {};
  const observations = {};
  const dt = datetime();
  const apiFetches = Object.values(apiURLs).map((url) => fetchData(url, dt));
  const results = await Promise.allSettled(apiFetches);
  results.forEach((result, i) => {
    if (result.status !== 'fulfilled') {
      console.log('API fetch failed:', apiKeys[i]);
      return;
    }
    const { body } = result.value;

    // Handle the actual API structure
    const responseData = body.data || body;
    const stations = responseData.stations || [];
    const readings = responseData.readings || [];

    stations.forEach((station) => {
      climateStations[station.id] = {
        lng: station.location.longitude,
        lat: station.location.latitude,
      };
    });

    // The readings array contains objects with timestamp and data array
    readings.forEach((readingGroup) => {
      const dataPoints = readingGroup.data || [];
      dataPoints.forEach((reading) => {
        if (!reading.value) return;
        const roundedValue = Number(reading.value.toFixed(1));
        if (observations[reading.stationId]) {
          observations[reading.stationId][apiKeys[i]] = roundedValue;
        } else {
          observations[reading.stationId] = {
            [apiKeys[i]]: roundedValue,
          };
        }
      });
    });
  });

  const obs = Object.entries(observations).map(([stationID, observation]) => {
    return {
      id: stationID,
      lng: +climateStations[stationID].lng.toFixed(4),
      lat: +climateStations[stationID].lat.toFixed(4),
      ...observation,
    };
  });

  return obs;
};

export async function GET(request) {
  try {
    const observations = await getObservations();
    return new Response(JSON.stringify(observations), {
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
