# Features

[Show prompt file](prompt.md)

Video Link - https://drive.google.com/file/d/1F5W-fUp1ugr_lWVGorubr5mksc7naX-y/view?usp=drive_link
Deployed Link - http://codebucket.santoshmanav.site
## Run steps

1. Backend:
   - Open a terminal in `backend`
   - Install dependencies: `npm install`
   - Start server: `npm run dev`
2. Frontend:
   - Open a terminal in `frontend`
   - Install dependencies: `npm install`
   - Start app: `npm run dev`

## Core simulation

- Input configuration for vehicles per lane, lane type, and density level
- Signal timing inputs (green, yellow, red) with auto-updating total cycle
- Queue length modeling and congestion estimation
- Optimized signal timing output
- Before vs after wait-time and congestion comparison
- Visual indicator for wait-time reduction

## Optimization controls

- Optimization focus: minimize wait time or maximize throughput
- Load balancing recommendations across lanes
- Emergency vehicle priority (lane + level)

## Live playback

- Live simulation playback of queue evolution
- Per-lane phase display (straight vs turn)
- Playback controls: play/pause and speed
- Phase timeline and per-lane queue bars

## Results and history

- Simulation results summary panel
- Saved runs list for quick comparison
- In-memory backend storage for recent simulations

## Backend services

- Node + Express backend with MVC + services structure
- Request/response/error logging middleware
- Input validation for simulation and playback payloads
- Health check endpoint
- Playback frame generation endpoint
