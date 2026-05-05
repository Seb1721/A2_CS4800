# CarKeeper

CarKeeper is now structured as a full-stack `Next.js` app with:

- `Next.js App Router` for frontend pages and backend route handlers
- `MongoDB` for user accounts, cars, and service history
- Secure cookie-based login using signed HTTP-only session cookies
- An AWS-friendly deployment path through `Amplify Hosting`

## Tech Stack

- `Next.js`
- `React`
- `TypeScript`
- `MongoDB Node Driver`
- `bcryptjs` for password hashing
- `jose` for signed session tokens

## Local Setup

Install dependencies:

```bash
npm install
```

Create an environment file from [.env.example](./.env.example):

```bash
cp .env.example .env.local
```

Set these values:

```bash
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB_NAME=carkeeper
AUTH_SECRET=replace_with_a_long_random_secret
CARKEEPER_ADMIN_USER=admin
CARKEEPER_ADMIN_EMAIL=admin@example.com
CARKEEPER_ADMIN_PASSWORD=replace_with_a_strong_password
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

`NEXT_PUBLIC_GA_ID` is your Google Analytics 4 measurement ID. Leave it blank to disable analytics for a local environment.

Start development:

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

## What Was Added

The new Next.js app lives in:

- [app](./app)
- [components](./components)
- [lib](./lib)

Key pieces:

- [app/page.tsx](./app/page.tsx): authenticated dashboard page
- [app/login/page.tsx](./app/login/page.tsx): login and registration page
- [app/api](./app/api): backend route handlers
- [lib/auth.ts](./lib/auth.ts): auth, hashing, cookie sessions
- [lib/cars.ts](./lib/cars.ts): MongoDB car and service logic
- [lib/mongodb.ts](./lib/mongodb.ts): shared MongoDB connection
- [app/healthz/route.ts](./app/healthz/route.ts): health check route

## Data Model

The new app uses MongoDB collections like:

- `users`
- `cars`
- `counters`

Each car record is scoped to the signed-in user through `ownerUsername`, so vehicle data is private per account.

## Authentication

Users can:

- create an account from the login page
- log in with a username and password
- log out with a secure session cookie cleared server-side

Passwords are hashed with `bcryptjs`.
Sessions are signed with `jose` and stored in an HTTP-only cookie.

## AWS Deployment

The recommended deployment target for this version is `AWS Amplify Hosting`.

This repo includes [amplify.yml](./amplify.yml), which uses:

- `npm ci`
- `npm run build`
- `.next` as the output directory

### Deploying to Amplify

1. Push this repo to GitHub, GitLab, Bitbucket, or CodeCommit.
2. In AWS Amplify, create a new app from the repo.
3. Add the environment variables from `.env.example` in the Amplify console.
4. Deploy the main branch.

HTTPS is handled by AWS hosting infrastructure automatically, so you do not need to manage TLS certificates inside the app.

## Useful Scripts

```bash
npm run dev
npm run build
npm run start
```

## Notes

- The repository has been cleaned up to keep the `Next.js` app as the only active application stack.
