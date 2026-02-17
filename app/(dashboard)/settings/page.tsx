import SettingsPageClient from "./SettingsPageClient";

export default function SettingsPage() {
  return (
    <SettingsPageClient
      priceIds={{
        monthly: process.env.STRIPE_PRICE_MONTHLY,
        annual: process.env.STRIPE_PRICE_ANNUAL,
      }}
    />
  );
}
