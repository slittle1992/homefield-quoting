# HomeField Quoting Tool

Progressive Web App for HomeField Artificial Turf sales reps. Draw backyard layouts on iPad, add turf zones, putting greens, pavers, fire pits, and generate professional quotes with pricing.

## Tech Stack
- React 18 + Vite
- PWA with offline support (vite-plugin-pwa)
- localStorage for saving quote versions
- SVG-based canvas with touch support

## Local Development

```bash
npm install
npm run dev
```

## Deploy to Vercel

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login
vercel login

# Deploy (follow prompts - framework: Vite)
vercel

# For production deploy:
vercel --prod
```

After deploying, open the URL on iPad Safari → Share → "Add to Home Screen" for a full-screen PWA experience.

## Features
- Draw yard boundaries with auto-zoom canvas
- Add turf zones (Builder/Standard/Premium), rock zones (Blackstar/Sunset)
- Putting green overlays with proportional cost subtraction
- Limestone pavers (2'×4', $150 each) with rotation
- Fire pits (41" diameter, $3,500 each)
- Architectural bird's-eye render view
- Professional quote view with line items
- PDF export via print dialog
- Save/load multiple quote versions (persisted in localStorage)
- Full iPad touch support with 6" snap grid
- Works offline once cached

## Pricing
- Builder Grade Turf: $8.73/sf
- Standard Turf: $10.84/sf
- Premium Turf: $12.31/sf
- Putting Green: $14.60/sf
- Texas Blackstar Rock: $12.18/sf
- Alabama Sunset Rock: $4.79/sf
- Limestone Pavers: $150 each
- Fire Pit: $3,500 each
- Labor: $4.50/sf (all surfaces)
- Tax: 8.25%
