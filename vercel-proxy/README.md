# OpenReply permanent URL proxy

This is not an application. It is a Vercel project whose only job is to own a
**stable public hostname** and forward every request to the OpenReply instance
running on the Oracle VPS.

## Why this exists

The app was reached through a Cloudflare *quick* tunnel
(`cloudflared tunnel --url http://localhost:3000`). Quick tunnels have no
persistent identity, so Cloudflare issues a new random
`*.trycloudflare.com` hostname every time the process starts. Each rotation
meant re-entering the OAuth redirect URI and webhook callback URL in the Meta
console.

A Cloudflare *named* tunnel would fix that, but it requires a domain on
Cloudflare. Serving TLS directly from the VPS requires inbound port 443, which
is closed in the Oracle security list and cannot be opened without console
access.

Vercel hands out a permanent `*.vercel.app` hostname for free with no domain, so
it is used purely as the stable front door.

## Topology

```
Meta / browsers
      |
      v  HTTPS (permanent hostname, Vercel-managed cert)
<project>.vercel.app
      |
      v  HTTP, port 80 (already open in the Oracle security list)
80.225.220.80  -> nginx -> Next.js on :3000
                              |
                              +-- PostgreSQL (localhost)
                              +-- Redis (localhost)
                              +-- BullMQ worker (PM2)
```

Nothing moves off the VPS. Postgres, Redis, and the worker stay on localhost,
so no database migration and no extra managed services are required.

## Deploying

Create a Vercel project with **Root Directory** set to `vercel-proxy`, framework
preset **Other**, and no build command. There is nothing to build; `vercel.json`
rewrites are the entire deployment.

## Known tradeoffs

- **The Vercel-to-Oracle hop is plain HTTP.** Session cookies and API payloads
  cross the public internet unencrypted on that leg. See the hardening note in
  `docs/` before treating this as production-ready.
- **Vercel's Hobby plan is limited to non-commercial personal use.** Commercial
  use requires Pro.
- Adds one network hop, so latency increases by roughly the round trip between
  the Vercel edge and Mumbai.

## Changing the target

If the Oracle public IP ever changes, update `destination` in `vercel.json` and
redeploy. The public hostname does not change, so the Meta console is never
touched again.
