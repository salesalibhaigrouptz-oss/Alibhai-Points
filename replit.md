# Alibhai Points

_A Tanzanian customer loyalty app for Alibhai customers to view points, purchase activity, redemptions, and account details._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/alibhai-points run dev` — run the Expo mobile app
- `pnpm --filter @workspace/alibhai-points run typecheck` — typecheck the mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Mobile: React Native, Expo Router, TanStack Query, Axios, React Hook Form, and Zod
- Mobile token storage: Expo SecureStore
- Build: esbuild (CJS bundle)

## Where things live

- Mobile routes: `artifacts/alibhai-points/app/`
- Mobile screens and shared controls: `artifacts/alibhai-points/components/`
- API contract: `lib/api-spec/openapi.yaml`
- Generated API client and schemas: `lib/api-client-react/` and `lib/api-zod/`
- Shared API server: `artifacts/api-server/`
- Mobile palette: `artifacts/alibhai-points/constants/colors.ts`

## Architecture decisions

- Alibhai's service is the source of truth for point balances, customer status, activity deadlines, eligibility, and the 25-/90-day program rules. The client displays server-provided values and does not calculate eligibility or expiration.
- The app stores access tokens in Expo SecureStore. OTP verification and customer registration must be completed by the service.
- The customer API in OpenAPI is a client contract only; the shared API server currently implements only its health route.
- Do not add sample balances, fake activity, products, a cart, checkout, shipping, or payments.

## Product

Customers can sign in or register with a phone number and one-time code; view their profile, point balances, purchase transactions, and redemption history; and request point redemptions. There is no ecommerce flow.

## User preferences

The initial scope is the mobile UI and typed API client. Do not invent OTP behavior, balances, or redemption rules; wait for the Alibhai API details before connecting live customer flows.

## Gotchas

- The customer API endpoints are not implemented in `artifacts/api-server`; the app should show service-unavailable states rather than substituting local data.
- When changing `lib/api-spec/openapi.yaml`, regenerate the client with `pnpm --filter @workspace/api-spec run codegen`; do not hand-edit generated client types.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
