![IAM Local Dashboard](https://iam-dropfiles.s3.af-south-1.amazonaws.com/Dropover/local-dashboard.png)

# IAM Local Dashboard

A real-time dashboard that automatically discovers and displays all your running localhost services in one place.

## What it does

IAM Local Dashboard watches through a [range of ports](#scanned-ports) for running development servers and displays them as interactive cards. Each card shows:

- Service name (extracted from the page title)
- Port number
- Favicon (when available)
- Direct link to open the service

The dashboard updates automatically via WebSocket - no manual refreshing needed. When you start or stop a local service, it appears or disappears from the dashboard in real-time.

## Scanned Ports

By default, the following ports are scanned:

- `3001-3010` - Node.js/React apps
- `4200` - Angular
- `5173-5180` - Vite
- `8000` - Python/Django
- `8080-8090` - Various dev servers
- `1313` - Hugo

You can customize the scanned ports in `server.ts` by modifying the `PORTS_TO_SCAN` array.

## Prerequisites

- Node.js (v18+)
- [Caddy](https://caddyserver.com/) - Used as a reverse proxy

### Installing Caddy

```bash
# macOS
brew install caddy

# Linux
sudo apt install -y caddy

# Or download from https://caddyserver.com/download
```

## Setup

1. Clone the repository and install dependencies:

```bash
bun install
```

2. Start the development server:

```bash
bun run dev
```

3. Open [https://mylocal.localhost](https://mylocal.localhost) or [http://localhost:3000](http://localhost:3000) in your browser.

## How it works

1. A custom Next.js server (`server.ts`) runs alongside the app
2. The server performs TCP port scans every 3 seconds to detect open ports
3. For each open port, it fetches the page title and favicon
4. Results are pushed to connected clients via WebSocket
5. Caddy proxies requests and handles WebSocket upgrades

## Tech Stack

- [Next.js 16](https://nextjs.org/) - React framework
- [Framer Motion](https://www.framer.com/motion/) - Animations
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Cheerio](https://cheerio.js.org/) - HTML parsing for titles/favicons
- [ws](https://github.com/websockets/ws) - WebSocket server
- [Caddy](https://caddyserver.com/) - Reverse proxy
