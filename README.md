# CheckWeather SG API

Singapore weather API providing real-time observations and radar rain data from government sources.

This is a rewrite of [rain-geojson-sg](https://github.com/cheeaun/rain-geojson-sg).

## API Endpoints

### `GET /v1/observations`
Returns real-time weather data from stations across Singapore.

**Response:**
```json
{
  "station_id": {
    "lng": 103.123,
    "lat": 1.234,
    "temp_celcius": 28.5,
    "relative_humidity": 85,
    "rain_mm": 0.2,
    "wind_direction": 180,
    "wind_speed": 5.2
  }
}
```

### `GET /v1/rainarea`
Returns processed radar images with rain coverage data and ASCII visualization.

**Query Parameters:**
- `dt` (optional) - Datetime in `YYYYMMDDHHMM` format (Singapore timezone), e.g. `202412151430` for Dec 15, 2024 at 2:30 PM SGT

**Response:**
```json
{
  "id": "202412151200",
  "dt": 202412151200,
  "coverage_percentage": {
    "all": 15.25,
    "sg": 12.80
  },
  "width": 480,
  "height": 480,
  "radar": "ASCII representation..."
}
```

## Development

```bash
npm install
npm start    # Vercel dev server at localhost:3000
npm test     # Run test suite
```

## Copyright/License

- Rain area radar images © [Meteorological Service Singapore](http://www.weather.gov.sg/) © [National Environment Agency](http://www.nea.gov.sg/)
- [Singapore region boundary](https://data.gov.sg/dataset/master-plan-2014-region-boundary-web), under [Singapore Open Data License](https://data.gov.sg/open-data-licence)
- Code under [MIT](https://cheeaun.mit-license.org/).
