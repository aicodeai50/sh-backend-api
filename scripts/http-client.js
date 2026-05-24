const http = require("http");
const https = require("https");
const { URL } = require("url");

function request(method, baseUrl, routePath, { apiKey, token, body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl.replace(/\/$/, "")}${routePath}`);
    const lib = url.protocol === "https:" ? https : http;
    const payload = body != null ? JSON.stringify(body) : null;

    const req = lib.request(
      url,
      {
        method,
        headers: {
          ...(apiKey ? { "x-sh-api-key": apiKey } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          let parsed = data;
          try {
            parsed = JSON.parse(data);
          } catch {}
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        });
      }
    );

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = { request };
