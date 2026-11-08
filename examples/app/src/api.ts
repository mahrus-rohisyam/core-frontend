import { createApiClient } from "@mahrus-rohisyam/core-api";
import type { paths } from "./schema.js";

/** The client for this app's own endpoints, typed from examples/app/openapi.json. */
export const api = createApiClient<paths>();
