export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN || "https://central-snake-0.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
