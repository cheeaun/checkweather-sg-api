export async function GET(request) {
  const projectInfo = {
    name: "CheckWeather SG API",
    version: "0.1.0",
    endpoints: [
      "/v1/observations",
      "/v1/rainarea"
    ]
  };

  return new Response(JSON.stringify(projectInfo, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
