/**
 * Reservation System - Entry Point
 *
 * All webhook routing, signature verification, and event dispatch
 * is handled by handlers/WebhookRouter.js
 *
 * Architecture:
 *   Production: LINE/Stripe → Cloudflare Worker (signature verification) → GAS (processing only)
 *   Test:       LINE → GAS (direct signature verification)
 *   Worker requests are identified by X-Verified header
 */

function doPost(e) {
  return routeWebhook(e);
}
