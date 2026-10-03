// Minimal static file server for the test harness: serves the project root.
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT) || 8765;
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png" };

http.createServer(function (req, res) {
  const file = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(port, function () { console.log("Serving " + root + " on http://localhost:" + port); });
