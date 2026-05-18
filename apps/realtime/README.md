# DHGC Realtime Backend

Cloudflare Worker + Durable Objects backend for room creation, room joining, WebSocket synchronization, and room export.

## Local Development

Dependencies are declared but not installed in this repository yet.

```powershell
npm install
npm run realtime:dev
```

The Worker exposes:

- `GET /api/health`
- `POST /api/rooms`
- `POST /api/rooms/join`
- `GET /api/rooms/:inviteCode/export/dhroom`
- `GET /api/rooms/:inviteCode/ws?token=...`

## D1

`schema.sql` contains the planned D1 persistence schema. The current MVP stores authoritative room snapshots in Durable Object storage first, so realtime development can begin before D1 is provisioned.
