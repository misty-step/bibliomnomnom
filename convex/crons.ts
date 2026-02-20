import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "recover stuck listening sessions",
  { minutes: 10 },
  internal.listeningSessions.recoverStuck,
);

export default crons;
