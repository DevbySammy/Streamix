export interface Env {
  TMDB_READ_ACCESS_TOKEN: string;
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const url = new URL(request.url);

    /*
     * Simple health check.
     * Visit /api/health after deployment to confirm
     * the Cloudflare Worker is running.
     */
    if (url.pathname === "/api/health") {
      return Response.json({
        status: "ok",
        service: "Streamix API"
      });
    }

    /*
     * TMDB search proxy.
     *
     * The browser calls:
     * /api/tmdb/search?query=batman&type=movie
     *
     * The TMDB token stays inside Cloudflare.
     */
    if (url.pathname === "/api/tmdb/search") {
      const query = url.searchParams.get("query");
      const type = url.searchParams.get("type") || "multi";

      if (!query) {
        return Response.json(
          { error: "Missing search query" },
          { status: 400 }
        );
      }

      let endpoint =
        "https://api.themoviedb.org/3/search/multi";

      if (type === "movie") {
        endpoint = "https://api.themoviedb.org/3/search/movie";
      }

      if (type === "tv") {
        endpoint = "https://api.themoviedb.org/3/search/tv";
      }

      const tmdbUrl = new URL(endpoint);

      tmdbUrl.searchParams.set("query", query);
      tmdbUrl.searchParams.set("include_adult", "false");
      tmdbUrl.searchParams.set("language", "en-US");

      const response = await fetch(tmdbUrl.toString(), {
        headers: {
          Authorization: `Bearer ${env.TMDB_READ_ACCESS_TOKEN}`,
          accept: "application/json"
        }
      });

      const data = await response.json();

      return Response.json(data, {
        status: response.status
      });
    }

    return new Response("Not Found", {
      status: 404
    });
  }
};
