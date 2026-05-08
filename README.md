# CarKeeper

CarKeeper is a Next.js vehicle maintenance tracker for managing garage records, mileage history, service logs, reminders, and fleet analytics.

## Stack

- Next.js App Router
- React and TypeScript
- MongoDB Node.js driver
- bcryptjs password hashing
- jose signed HTTP-only session cookies

## Environment

Create `.env.local` from `.env.example` and set:

```bash
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB_NAME=carkeeper
AUTH_SECRET=replace_with_a_long_random_secret
CARKEEPER_ADMIN_USER=admin
CARKEEPER_ADMIN_EMAIL=admin@example.com
CARKEEPER_ADMIN_PASSWORD=replace_with_a_strong_password
NEXT_PUBLIC_GA_ID=
COOKIE_SECURE=false
```

Use `COOKIE_SECURE=true` in production HTTPS environments. `NEXT_PUBLIC_GA_ID` is optional.

## Development

```bash
npm install
npm run dev
```

The local app runs at `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm test
```

## Project Structure

- `app/`: routes, pages, API handlers, and app metadata
- `components/`: shared React UI
- `lib/`: authentication, MongoDB access, vehicle logic, analytics helpers
- `tests/`: Node test runner coverage for vehicle and insight logic

## Data

MongoDB collections:

- `users`
- `cars`
- `counters`

Vehicle data is scoped by `ownerUsername`, so each account only sees its own records.

## Analytics

Vehicle insights and fleet analytics are calculated from current service and mileage records. Historical service entries are supported, and graphs recalculate from the latest saved records. Graphs show cumulative miles added and total spending over the selected window, with manual window changes applied through the `Apply Window` action and presets applied immediately.

Service history defaults to newest-first and can be toggled to oldest-first when reviewing vehicle records.

## Deployment

The app can deploy to AWS Amplify Hosting or a Node-capable server such as EC2. Required production environment variables match `.env.example`; use HTTPS with `COOKIE_SECURE=true`.
