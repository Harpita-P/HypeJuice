import { Hono } from "hono";
import { billingStatus, BillingError } from "./billing.js";

export const billingRoutes = new Hono();
billingRoutes.get("/status", async (c) => {
  try { return c.json(await billingStatus()); }
  catch (error) { return c.json({ error: error instanceof BillingError ? error.message : "Subscription status unavailable." }, 503); }
});
