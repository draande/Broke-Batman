import { privateResponse } from "@/server/http/router";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = privateResponse,
  POST = privateResponse,
  PUT = privateResponse,
  PATCH = privateResponse,
  DELETE = privateResponse;
