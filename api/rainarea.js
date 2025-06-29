import { PNG } from 'pngjs';
import nearestColor from 'nearest-color';

import sgCoverageIndices from '../sg-coverage-indices.json' with { type: 'json' };
const totalSgCells = sgCoverageIndices.reduce((acc, v) => acc + v.length, 0);

const offset = 8; // Singapore timezone +0800
function datetimeNowStr(customMinutes) {
  // https://stackoverflow.com/a/11124448/20838
  const d = new Date(new Date().getTime() + offset * 3600 * 1000);
  if (customMinutes) d.setUTCMinutes(d.getUTCMinutes() + customMinutes);
  const year = d.getUTCFullYear();
  const month = ('' + (d.getUTCMonth() + 1)).padStart(2, '0');
  const day = ('' + d.getUTCDate()).padStart(2, '0');
  const hour = ('' + d.getUTCHours()).padStart(2, '0');
  const min = ('' + d.getUTCMinutes()).padStart(2, '0');
  return parseInt(year + month + day + hour + min, 10);
}

function datetimeStr(customMinutes) {
  const d = datetimeNowStr(customMinutes);
  return Math.floor(d / 5) * 5;
}

const shortenPercentage = (percentage) => +percentage.toFixed(2);
// Simple in-memory cache (note: this will be reset between function invocations)
const requestCache = new Map();

const apiURLs = [
  (dt) => `https://www.weather.gov.sg/files/rainarea/50km/v2/dpsri_70km_${dt}0000dBR.dpsri.png`,
  (dt) => `https://www.nea.gov.sg/docs/default-source/rain-area/dpsri_70km_${dt}0000dBR.dpsri.png`,
];

// Helper for retrying fetch with backoff
const retryStatusCodes = [302, 404, 408, 413, 429, 500, 502, 503, 504, 521, 522, 524];
async function fetchWithRetry(url, options = {}, retries = 2) {
  try {
    // Check cache first
    if (requestCache.has(url)) {
      return {
        ok: true,
        headers: { 'content-type': 'image/png' },
        body: requestCache.get(url)
      };
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      if (retries > 0 && retryStatusCodes.includes(response.status)) {
      console.log(`♻️ Retry: ${response.status}, ${retries} left`);
        await new Promise(resolve => setTimeout(resolve,500)); // .5s delay
        return fetchWithRetry(url, options, retries - 1);
      }
      throw new Error(`HTTP error: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const data = Buffer.from(buffer);

    // Cache the successful response
    requestCache.set(url, data);

    return {
      ok: true,
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') },
      body: data
    };
  } catch (error) {
    if (retries > 0 && error.name !== 'AbortError') {
      console.log(`♻️ Retry: ${error.message}, ${retries} left`);
      await new Promise(resolve => setTimeout(resolve, 500)); // .5s delay
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}
const fetchRadar = (dt, opts = {}) =>
  new Promise(async (resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 3000); // 3 second timeout

    console.log('🥏', dt);

    try {
      const concurrent = opts.concurrent || false;

      let response;
      let url;

      if (concurrent) {
        // Race both URLs simultaneously (no retries)
        const url1 = apiURLs[0](dt);
        const url2 = apiURLs[1](dt);

        const fetchOptions = {
          signal: controller.signal,
          headers: { 'user-agent': undefined },
          redirect: 'manual'
        };

        const raceResult = await Promise.any([
          fetchWithRetry(url1, fetchOptions, 0).then(res => ({ response: res, url: url1 })),
          fetchWithRetry(url2, fetchOptions, 0).then(res => ({ response: res, url: url2 }))
        ]);

        response = raceResult.response;
        url = raceResult.url;
        console.log(`🥇 ${url}`);
      } else {
        // Sequential with retries
        const retryLimit = opts.retry !== undefined ? opts.retry : 0;

        // Try first URL (index 0)
        try {
          url = apiURLs[0](dt);
          console.log(`➡️ ${url}`);
          response = await fetchWithRetry(
            url,
            {
              signal: controller.signal,
              headers: { 'user-agent': undefined },
              redirect: 'manual' // Similar to maxRedirects: 1
            },
            retryLimit
          );
        } catch (error) {
          // Try second URL (index 1) if first one fails
          url = apiURLs[1](dt);
          console.log(`↔️ ${url}`);

          response = await fetchWithRetry(
            url,
            {
              signal: controller.signal,
              headers: { 'user-agent': undefined },
              redirect: 'manual'
            },
            retryLimit
          );
        }
      }

      clearTimeout(timeoutId);

      const { body, headers } = response;

      if (!headers['content-type'].includes('image/png')) {
        console.log('⚠️ Radar image is not a PNG image.');
        reject(e);
        return;
      }

      new PNG({ filterType: 4, checkCRC: false }).parse(
        body,
        function (error, data) {
          if (error) {
            reject(error);
            return;
          }
          resolve(data);
        }
      );
    } catch (e) {
      clearTimeout(timeoutId);

      if (e.status === 404 || e.message.includes('404')) {
        reject(new Error('Page not found'));
      } else {
        console.log('⚠️', {
          message: e.message,
          code: e.code,
        });
        reject(e);
      }
    }
  });

// Color scales
const intensityColors = [
  '#40FFFD',
  '#3BEEEC',
  '#32D0D2',
  '#2CB9BD',
  '#229698',
  '#1C827D',
  '#1B8742',
  '#229F44',
  '#27B240',
  '#2CC53B',
  '#30D43E',
  '#38EF46',
  '#3BFB49',
  '#59FA61',
  '#FEFB63',
  '#FDFA53',
  '#FDEB50',
  '#FDD74A',
  '#FCC344',
  '#FAB03F',
  '#FAA23D',
  '#FB8938',
  '#FB7133',
  '#F94C2D',
  '#F9282A',
  '#DD1423',
  '#BE0F1D',
  '#B21867',
  '#D028A6',
  '#F93DF5',
];
const intensityColorsCount = intensityColors.length;
const nColor = nearestColor.from(intensityColors);
const getIntensity = (color) => {
  const c = nColor(color);
  const index = intensityColors.indexOf(c);
  return Math.ceil(((index + 1) / intensityColorsCount) * 100);
};

const formatAscii = (data) =>
  data
    .map((y) => {
      let text = '';
      y.forEach((x) => {
        text += x ? String.fromCharCode(x + 33) : ' ';
      });
      return text.trimEnd();
    })
    .join('\n');

const convertImageToData = (img) => {
  const intensityData = [];
  let coverageCount = 0;
  let sgCoverageCount = 0;

  const { width, height, data } = img;
  const totalCells = width * height;

  for (let y = 0; y < height; y++) {
    intensityData.push([]);
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const alpha = data[idx + 3];
      const hasColor = alpha > 0;
      const intensity = hasColor ? getIntensity({ r, g, b }) : 0;
      intensityData[y].push(intensity);
      if (hasColor) {
        if (sgCoverageIndices[y].includes(x)) sgCoverageCount++;
        coverageCount++;
      }
    }
  }

  return {
    coverage_percentage: {
      all: shortenPercentage((coverageCount / totalCells) * 100),
      sg: shortenPercentage((sgCoverageCount / totalSgCells) * 100),
    },
    width,
    height,
    radar: formatAscii(intensityData),
  };
};

const cachedOutput = {};

export async function GET(request) {
  console.log('❇️ START');
  try {
    let dt, output;
    const url = new URL(request.url);
    const queryDt = url.searchParams.get('dt');

    if (queryDt) {
      dt = +queryDt;
      output = cachedOutput[dt];
      if (!output) {
        const img = await fetchRadar(dt, { retry: 2 });
        if (!img) {
          throw new Error(`Timeout: ${dt}`);
        }
        const rainareas = convertImageToData(img);
        output = cachedOutput[dt] = {
          id: '' + dt,
          dt,
          ...rainareas,
        };
      } else {
        console.log('🥞', dt);
      }

      return new Response(JSON.stringify(output), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'ETag': `"${dt}"`, // Add ETag for caching
        },
      });
    } else {
      dt = datetimeStr();
      output = cachedOutput[dt];

      if (!output) {
        let img;
        try {
          img = await fetchRadar(dt);
          if (!img) {
            throw new Error(`Timeout: ${dt}`);
          }
        } catch (e) {
          for (let i = 1; i <= 12; i++) {
            // Step back 5 minutes every time
            dt = datetimeStr(i * -5);
            console.log('⌛ Step back', dt);
            output = cachedOutput[dt];
            if (output) {
              console.log('🥞', dt);
              break;
            }
            try {
              img = await fetchRadar(dt, { concurrent: true });
              if (img) break;
            } catch (e) {
              console.log('⌛⚠️', e.message);
            }
          }
        }

        if (!output) {
          const rainareas = convertImageToData(img);
          output = cachedOutput[dt] = {
            id: '' + dt,
            dt,
            ...rainareas,
          };
        }
      } else {
        console.log('🥞', dt);
      }

      return new Response(JSON.stringify(output), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30, must-revalidate',
          'ETag': `"${dt}"`, // Add ETag for caching
        },
      });
    }
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.stack || e }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  }
}
