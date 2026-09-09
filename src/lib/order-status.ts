/**
 * The "out_for_delivery" step in the order flow means different things
 * depending on how the order will be fulfilled:
 *  - delivery orders: it's literally on its way to the customer
 *  - pickup orders: there's no delivery leg at all — it just means the
 *    order is ready and waiting for the customer to come get it
 *
 * Every place that shows this step to a customer or staff member should
 * go through this helper so the wording always matches the order's type,
 * instead of hardcoding delivery language.
 */
export function outForDeliveryStepLabel(orderType: string): string {
  return orderType === "pickup" ? "ready for pickup" : "out for delivery";
}

/**
 * Lowercase, space-separated phrase for an order status, aware of order
 * type for the out_for_delivery step. Callers apply their own casing
 * (e.g. a `capitalize` CSS class, or manual Title Case) on top of this,
 * same as they did with the old `.replace(/_/g, " ")` pattern.
 */
export function orderStatusPhrase(status: string, orderType: string): string {
  if (status === "out_for_delivery") return outForDeliveryStepLabel(orderType);
  return status.replace(/_/g, " ");
}
