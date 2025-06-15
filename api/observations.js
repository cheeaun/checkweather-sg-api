const apiURLs = {
  temp_celcius: 'https://api-open.data.gov.sg/v2/real-time/api/air-temperature',
  rain_mm: 'https://api-open.data.gov.sg/v2/real-time/api/rainfall',
  relative_humidity: 'https://api-open.data.gov.sg/v2/real-time/api/relative-humidity',
  wind_direction: 'https://api-open.data.gov.sg/v2/real-time/api/wind-direction',
  wind_speed: 'https://api-open.data.gov.sg/v2/real-time/api/wind-speed',
};
const apiKeys = Object.keys(apiURLs);

let lastCache = {};

const fetchData = async (url) => {
  console.log(`➡️ ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

  try {
    const response = await fetch(url, {
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

    lastCache[url] = result;

    const readings = body?.data?.readings || [];
    const timestamps = readings.map(reading => reading?.timestamp).filter(Boolean);
    const timestampInfo = timestamps.length > 0 ? ` (${timestamps.join(', ')})` : '';

    console.log(`✅ ${url}${timestampInfo}`);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);

    if (lastCache[url]) {
      console.log(`🥞 ${url}`);
      return lastCache[url];
    }

    console.log(`❌ ${url}`);
    return {};
  }
};

// id, lng, lat, temp_celcius, relative_humidity, rain_mm, wind_direction, wind_speed

const getObservations = async () => {
  const climateStations = {};
  const observations = {};

  const apiFetches = Object.values(apiURLs).map(fetchData);
  const results = await Promise.allSettled(apiFetches);
  results.forEach((result, i) => {
    if (result.status !== 'fulfilled') {
      console.log('Unexpected error for:', apiKeys[i], result.reason);
      return;
    }
    const { body } = result.value;

    // Handle the actual API structure
    const stations = body?.data?.stations || [];
    const readings = body?.data?.readings || [];

    stations.forEach((station) => {
      if (station?.id && station?.location) {
        climateStations[station.id] = {
          lng: station.location?.longitude,
          lat: station.location?.latitude,
        };
      }
    });

    // The readings array contains objects with timestamp and data array
    readings.forEach((readingGroup) => {
      const dataPoints = readingGroup?.data || [];
      dataPoints.forEach((reading) => {
        if (!reading?.value || !reading?.stationId) return;
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
    const station = climateStations[stationID];
    return {
      id: stationID,
      lng: station?.lng ? +station.lng.toFixed(4) : undefined,
      lat: station?.lat ? +station.lat.toFixed(4) : undefined,
      ...observation,
    };
  }).filter(obs => obs.lng !== undefined && obs.lat !== undefined);

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
