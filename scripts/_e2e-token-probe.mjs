// Hermetic token probe: mint an E2E access token with the same claims the
// auth helper uses and print it. The secret comes from the environment.
import { SignJWT } from 'jose';

const secret = process.env.AUTH_JWT_SECRET;
if (!secret) {
  console.error('AUTH_JWT_SECRET missing');
  process.exit(1);
}
const SECRET = new TextEncoder().encode(secret);
const token = await new SignJWT({
  sub: 'e2e-user',
  email: 'e2e@vedmoulya.com',
  role: 'user',
  type: 'access',
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .setExpirationTime('1h')
  .setIssuer('vedmoulya')
  .setAudience('vedmoulya-api')
  .sign(SECRET);
console.log(token);
