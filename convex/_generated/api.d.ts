/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_bookSearch from "../actions/bookSearch.js";
import type * as actions_coverFetch from "../actions/coverFetch.js";
import type * as actions_profileInsights from "../actions/profileInsights.js";
import type * as auth from "../auth.js";
import type * as books from "../books.js";
import type * as imports from "../imports.js";
import type * as notes from "../notes.js";
import type * as profiles from "../profiles.js";
import type * as subscriptions from "../subscriptions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "actions/bookSearch": typeof actions_bookSearch;
  "actions/coverFetch": typeof actions_coverFetch;
  "actions/profileInsights": typeof actions_profileInsights;
  auth: typeof auth;
  books: typeof books;
  imports: typeof imports;
  notes: typeof notes;
  profiles: typeof profiles;
  subscriptions: typeof subscriptions;
  users: typeof users;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
