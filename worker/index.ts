export interface Env {
  TMDB_READ_ACCESS_TOKEN: string;
  DB: D1Database;
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const url = new URL(request.url);

    // --------------------------------------------------
    // CORS
    // --------------------------------------------------

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const json = (
      data: unknown,
      status = 200
    ) => {
      return Response.json(data, {
        status,
        headers: corsHeaders
      });
    };

    // --------------------------------------------------
    // HEALTH CHECK
    // --------------------------------------------------

    if (url.pathname === "/api/health") {
      return json({
        status: "ok",
        service: "Streamix API",
        tmdbConfigured: Boolean(
          env.TMDB_READ_ACCESS_TOKEN
        ),
        databaseConfigured: Boolean(env.DB)
      });
    }

    // ==================================================
    // PROFILES
    // ==================================================

    if (
      url.pathname === "/api/profiles" &&
      request.method === "GET"
    ) {
      const result = await env.DB
        .prepare(`
          SELECT *
          FROM profiles
          ORDER BY sort_order ASC, created_at ASC
        `)
        .all();

      return json(result.results);
    }

    if (
      url.pathname === "/api/profiles" &&
      request.method === "POST"
    ) {
      const body = await request.json<{
        id?: string;
        name
