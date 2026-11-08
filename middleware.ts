/**
 * Next.js Middleware for Setlist Studio
 *
 * Checks PIN authentication session token/header for protected API routes.
 * In a Next.js deployment, this file intercepts incoming requests and ensures
 * that admin endpoints (/api/admin/*) require the ADMIN role or PIN.
 */

// If running in Next.js edge runtime
export const config = {
  matcher: ['/api/admin/:path*', '/admin/:path*'],
};

export default function middleware(request: any) {
  // Extract custom auth header or session cookie
  const authHeader = request.headers?.get?.('x-setlist-role') || '';
  const adminPinHeader = request.headers?.get?.('x-admin-pin') || '';

  const serverAdminPin = process.env.ADMIN_PIN || '7890';

  if (authHeader === 'admin' || adminPinHeader === serverAdminPin) {
    // Authorized
    return;
  }

  // If unauthorized access to admin route in Next.js:
  // (In Next.js Response is globally available)
  if (typeof Response !== 'undefined') {
    return new Response(JSON.stringify({ error: 'Neoprávněný přístup. Vyžadována role administrátora.' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }
}
