# PraxisFlow AI

AI-powered medical practice simulation for optimizing clinic workflows, efficiency, and staff harmony.

## Authentication

This application uses Replit Auth (OIDC) for authentication. All API endpoints require authentication except:
- `GET /api/login` - Initiates OAuth login
- `GET /api/callback` - OAuth callback
- `GET /api/logout` - Logout
- `GET /api/debug/status` - Debug endpoint (dev only)

## Testing Authentication

### Automated Smoke Test

Run the auth smoke test to verify unauthenticated requests are blocked:

```bash
npx tsx scripts/smoke-auth.ts
```

Expected output:
```
🔐 Auth Smoke Test
==================
✅ OK - GET /api/benchmarks ohne Auth → 401
✅ OK - GET /api/me ohne Auth → 401
✅ OK - PUT /api/rooms/fake-id ohne Auth → 401
✅ OK - GET /api/practices/fake-id ohne Auth → 401
✅ OK - POST /api/simulations/run ohne Auth → 401
```

### Manual Cross-Tenant Access Test

To verify that users cannot access other users' practices:

1. **Login as User A:**
   - Open the app in Browser 1
   - Click "Login with Replit"
   - Note the practiceId from `/api/me` response

2. **Login as User B:**
   - Open the app in Browser 2 (or incognito)
   - Login with a different Replit account
   - Note User B's practiceId

3. **Test Cross-Tenant Access:**
   - In Browser 2 (logged in as User B), open DevTools Console
   - Run:
   ```javascript
   fetch('/api/practices/[USER_A_PRACTICE_ID]', { credentials: 'include' })
     .then(r => console.log('Status:', r.status))
   ```
   - **Expected:** Status 403 (Access denied)

4. **Test Resource Access:**
   - Try accessing User A's rooms:
   ```javascript
   fetch('/api/rooms/[USER_A_ROOM_ID]', { 
     method: 'PUT', 
     credentials: 'include',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ name: 'Hacked' })
   }).then(r => console.log('Status:', r.status))
   ```
   - **Expected:** Status 403 or 404

## API Endpoints

### Authentication
- `GET /api/login` - Start Replit OAuth flow
- `GET /api/callback` - OAuth callback (handled automatically)
- `GET /api/logout` - Logout and clear session
- `GET /api/me` - Get current user and practiceId
- `GET /api/auth/user` - Same as /api/me

### Protected Endpoints
All other `/api/*` endpoints require authentication and enforce practice ownership.

## Development

```bash
npm run dev       # Start development server
npm run db:push   # Sync database schema
```
