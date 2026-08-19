export interface Env {
  TMDB_READ_ACCESS_TOKEN: string;
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const url = new URL(request.url);

    // Temporary health check
    if (url.pathname === "/api/health") {
      return Response.json({
        status: "ok",
        service: "Streamix API"
      });
    }

    // TMDB API proxy
    if (url.pathname === "/api/tmdb/search") {
      const query = url.searchParams.get("query");
      const type = url.searchParams.get("type") || "multi";

      if (!query) {
        return Response.json(
          { error: "Missing search query" },
          { status: 400 }
        );
      }

      const endpoint =
        type === "movie"
          ? "https://api.themoviedb.org/3/search/movie"
          : type === "tv"
            ? "https://api.themoviedb.org/3/search/tv"
            : "https://api.themoviedb.org/3/search/multi";

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

    return new Response(null, { status: 404 });
  }
};
