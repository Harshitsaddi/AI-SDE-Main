export async function readJsonRequest(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks);

  if (rawBody.length === 0) {
    return { rawBody, body: null };
  }

  return {
    rawBody,
    body: JSON.parse(rawBody.toString("utf8"))
  };
}

export function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  response.end(body);
}
