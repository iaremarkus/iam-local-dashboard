import { NextResponse } from "next/server";
import net from "net";
import * as cheerio from "cheerio";
import { URL } from "url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CONFIGURATION: Define single ports OR ranges
const PORTS_TO_SCAN = [
  3000,
  "3001-3010", // Scans range
  4200,
  5173,
  "5173-5176", // Vite
  8000,
  "8080-8090",
  1313,
];

// --- HELPERS ---

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
    const hosts = ["127.0.0.1", "::1"]; // Try IPv4 and IPv6 loopback

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
  // Try IPv4 first, then IPv6 (e.g. Vite usually runs on [::1])
  const hosts = ["127.0.0.1", "[::1]"];

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
      const favicon = new URL(faviconPath, baseUrl).href;

      return { title, favicon };

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // SILENT CATCH: It is normal for 127.0.0.1 to fail if app is on [::1]
      // We do NOT console.error here to avoid terminal noise
      clearTimeout(timeoutId);
    }
  }

  // If both IPs failed to return HTML
  return { title: `Unknown Service (${port})`, favicon: null };
};

// --- MAIN ROUTE ---

export async function GET() {
  const targetPorts = parsePorts(PORTS_TO_SCAN);
  const openPorts: number[] = [];

  // Batch scan
  const CHUNK_SIZE = 50;

  for (let i = 0; i < targetPorts.length; i += CHUNK_SIZE) {
    const chunk = targetPorts.slice(i, i + CHUNK_SIZE);

    const chunkResults = await Promise.all(
      chunk.map(async (port) => {
        const isOpen = await checkPort(port);
        return isOpen ? port : null;
      })
    );

    openPorts.push(...chunkResults.filter((p) => p !== null));
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

  return NextResponse.json(finalResults);
}
