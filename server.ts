import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import net from "net";
import * as cheerio from "cheerio";
import { URL } from "url";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// --- SCANNING LOGIC (Adapted from app/api/scan/route.ts) ---

// CONFIGURATION: Define single ports OR ranges
const PORTS_TO_SCAN = [
  "3000-3010", // Scans range
  4200,
  "5173-5176", // Vite
  8000,
  "8080-8090",
  1313,
];

// Determine scan target
const SCAN_HOST = "127.0.0.1";

// 1. Expand config into a flat array of numbers
const parsePorts = (config: (number | string)[]): number[] => {
  const ports = new Set<number>();

  config.forEach((item) => {
    if (typeof item === "number") {
      ports.add(item);
    } else if (typeof item === "string" && item.includes("-")) {
      const [start, end] = item.split("-").map(Number);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          ports.add(i);
        }
      }
    }
  });

  return Array.from(ports).sort((a, b) => a - b);
};

// 2. Check if a single port is open (TCP check)
const checkPort = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const hosts = [SCAN_HOST];
    // If not in docker mode, we might want to try ::1 too, but for simplicity
    // and to fix the docker issue, let's stick to the primary host.
    // If local, SCAN_HOST is 127.0.0.1.
    if (SCAN_HOST === "127.0.0.1") {
      hosts.push("::1");
    }

    let settled = false;
    let pending = hosts.length;

    const done = (val: boolean) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };

    hosts.forEach((host) => {
      const socket = new net.Socket();
      socket.setTimeout(200); // Timeout in ms

      socket.once("connect", () => {
        socket.destroy();
        done(true);
      });

      const fail = () => {
        socket.destroy();
        pending -= 1;
        if (pending === 0) done(false);
      };

      socket.once("timeout", fail);
      socket.once("error", fail);

      socket.connect({ port, host });
    });
  });
};

// 3. Fetch Title AND Favicon (Updated Logic)
const getServiceDetails = async (port: number) => {
  const hosts = [SCAN_HOST];
  if (SCAN_HOST === "127.0.0.1") {
    hosts.push("[::1]");
  }

  for (const host of hosts) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const baseUrl = `http://${host}:${port}`;

    try {
      const res = await fetch(baseUrl, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const html = await res.text();
      const $ = cheerio.load(html);

      // Get Title
      const title = $("title").text() || `Service (${port})`;

      // Get Favicon
      const faviconPath =
        $('link[rel="icon"]').attr("href") ||
        $('link[rel="shortcut icon"]').attr("href") ||
        "/favicon.ico";

      // Resolve full URL (handles relative paths like "/vite.svg")
      // IMPORTANT: We want the frontend to use localhost, not host.docker.internal
      // So we use the baseUrl for resolving relative paths, but the final URL
      // sent to frontend should use localhost if possible, OR we just pass the path
      // and let frontend handle it?
      // Actually, `new URL(path, baseUrl)` creates a string with `http://host.docker.internal:port/...`
      // We need to replace that host with localhost for the user's browser.

      const resolvedUrl = new URL(faviconPath, baseUrl);
      if (resolvedUrl.hostname === "host.docker.internal") {
        resolvedUrl.hostname = "localhost";
      }
      const favicon = resolvedUrl.href;

      return { title, favicon };

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // SILENT CATCH
      clearTimeout(timeoutId);
    }
  }

  // If both IPs failed to return HTML
  return { title: `Unknown Service (${port})`, favicon: null };
};

const performScan = async () => {
  const targetPorts = parsePorts(PORTS_TO_SCAN);
  const openPorts: number[] = [];

  // Batch scan
  const CHUNK_SIZE = 50;

  for (let i = 0; i < targetPorts.length; i += CHUNK_SIZE) {
    const chunk = targetPorts.slice(i, i + CHUNK_SIZE);

    const chunkResults = await Promise.all(
      chunk.map(async (port) => {
        // Don't scan our own port to avoid recursion/confusion if we were in the list
        if (port === 3000) return null;
        const isOpen = await checkPort(port);
        return isOpen ? port : null;
      })
    );

    openPorts.push(...(chunkResults.filter((p) => p !== null) as number[]));
  }

  // Fetch details for open ports
  const finalResults = await Promise.all(
    openPorts.map(async (port) => {
      const details = await getServiceDetails(port);
      return {
        port,
        url: `http://localhost:${port}`,
        ...details, // Spreads { title, favicon }
      };
    })
  );

  return finalResults;
};

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const parsedUrl = parse(req.url || "", true);

    // Only handle upgrades for our custom WebSocket endpoint
    if (parsedUrl.pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      // For HMR and others, we can't easily handle it in custom server without deep integration.
      // We just destroy the socket to prevent hanging, or ignore it.
      // Next.js HMR might try to connect, fail, and retry.
      // Ideally we would pass it to Next.js, but there's no public API for that in custom server.
      // Let's just ignore it for now.
    }
  });

  wss.on("connection", (ws) => {
    ws.on("error", (err) => {
      console.error("WebSocket client error:", err);
    });

    // Send immediate scan on connection
    performScan().then((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    });

    ws.on("close", () => {});
  });

  // Periodic scan
  setInterval(async () => {
    if (wss.clients.size > 0) {
      const data = await performScan();
      const message = JSON.stringify(data);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }, 3000); // Scan every 3 seconds

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
