# Backend Setup Guide

## Prerequisites
- PostgreSQL 14+ with PostGIS extension
- Node.js 18+

## Step 1 — Create database
```sql
-- In psql or pgAdmin:
CREATE DATABASE agri_risk_burning;
\c agri_risk_burning
CREATE EXTENSION postgis;
```

## Step 2 — Configure environment
```bash
cd backend
copy .env.example .env
# Edit .env: set DB_PASSWORD to your postgres password
```

## Step 3 — Install Node dependencies
```bash
cd backend
npm install
```

## Step 4 — Initialize schema
```bash
node db/init.js
```
Expected output: `✅ Schema ready.`

## Step 5 — Seed hotspot data
Place GeoJSON files in `../data/hotspot/` then:
```bash
node db/seed.js
```

## Step 6 — Start API server
```bash
npm start
# or for auto-reload:
npm run dev
```
API available at: http://localhost:3001

## Step 7 — Compute risk scores
```bash
curl -X POST http://localhost:3001/api/risk/compute
```

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | DB status + hotspot count |
| GET | /api/stats | All dashboard data in one call |
| GET | /api/hotspots | Hotspot records (filters: year, province, district) |
| GET | /api/hotspots/geojson | GeoJSON for map |
| GET | /api/hotspots/trend | Yearly counts |
| GET | /api/hotspots/top | Top provinces or districts |
| GET | /api/risk | Risk scores table |
| GET | /api/risk/geojson | Risk scores as GeoJSON |
| POST | /api/risk/compute | Recompute all risk scores |
| GET | /api/boundary/provinces/geojson | Province polygons |
| GET | /api/boundary/districts/geojson | District polygons |
