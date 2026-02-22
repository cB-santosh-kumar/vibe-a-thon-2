# Traffic Simulator Backend

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a .env file (optional):
   ```bash
   PORT=5000
   ```

3. Run in dev mode:
   ```bash
   npm run dev
   ```

## Endpoints

- `GET /health`
- `POST /traffic/simulate`
- `GET /traffic/simulations`

## Notes

- Uses in-memory storage for simulations (last 20 runs).
- Follows MVC + services structure for maintainability.
