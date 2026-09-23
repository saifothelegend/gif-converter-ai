import http from "node:http";

/**
 * Free hosts like Render classify a service as a "web service" and expect
 * it to bind to $PORT and answer HTTP requests. They also spin the
 * service down after ~15 minutes with no inbound HTTP traffic.
 *
 * This tiny server does two jobs:
 *  1. Satisfies the "bind to a port" requirement so the platform treats
 *     the bot as healthy.
 *  2. Gives an external free uptime pinger (see README) something to hit
 *     every few minutes, which resets the inactivity timer and keeps the
 *     Discord gateway connection alive 24/7 without paying for an
 *     "always-on" plan.
 */
export function startKeepAliveServer(port: number, getStatus: () => Record<string, unknown>) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, ...getStatus() }));
  });

  server.listen(port, () => {
    console.log(`[keepalive] Listening on port ${port} (ping this URL every few minutes to prevent sleep).`);
  });

  return server;
}
