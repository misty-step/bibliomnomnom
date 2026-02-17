export type StripePriceIds = {
  monthly?: string;
  annual?: string;
};

export type PlanName = "Monthly" | "Annual" | "Standard";

export function getPlanNameFromPriceId(
  priceId: string | undefined,
  priceIds: StripePriceIds,
): PlanName {
  if (!priceId) return "Standard";
  if (priceIds.monthly && priceId === priceIds.monthly) return "Monthly";
  if (priceIds.annual && priceId === priceIds.annual) return "Annual";
  return "Standard";
}
