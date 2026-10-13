// Browser tests only: forwards :8788 → :8787 keeping the Host, drops the cookie
// Domain (browsers refuse ".localhost:8787") and sends the https Origin the
// auth library trusts. Websockets pass straight through.
import http from "node:http";
import net from "node:net";
const fix = (v) => String(v).replace(":8788", ":8787");
http.createServer((req, res) => {
  const headers = { ...req.headers };
  if (headers.origin) headers.origin = fix(headers.origin).replace("http://", "https://");
  if (headers.host) headers.host = fix(headers.host);
  const up = http.request({ host: "127.0.0.1", port: 8787, method: req.method, path: req.url, headers }, (r) => {
    const h = { ...r.headers };
    if (h["set-cookie"]) h["set-cookie"] = h["set-cookie"].map((c) => c.replace(/;\s*Domain=[^;]*/i, "").replace(/;\s*Secure/i, ""));
    if (h.location) h.location = h.location.replace(":8787", ":8788");
    res.writeHead(r.statusCode, h);
    r.pipe(res);
  });
  up.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(up);
}).on("upgrade", (req, socket, head) => {
  const up = net.connect(8787, "127.0.0.1", () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${fix(req.rawHeaders[i + 1])}`);
    up.write(lines.join("\r\n") + "\r\n\r\n");
    if (head.length) up.write(head);
    socket.pipe(up).pipe(socket);
  });
  up.on("error", () => socket.destroy());
  socket.on("error", () => up.destroy());
}).listen(8788, () => console.log("proxy on 8788"));
