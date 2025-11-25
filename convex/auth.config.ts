const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN;

if (!issuer) {
  throw new Error("CLERK_JWT_ISSUER_DOMAIN environment variable is required");
}

export default {
  providers: [
    {
      domain: issuer,
      applicationID: "convex",
    },
  ],
};
