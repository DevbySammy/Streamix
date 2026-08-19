export interface Env {
  TMDB_READ_ACCESS_TOKEN: string;
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const url = new URL(request.url);

    // --------------------------------------------------
    // HEALTH CHECK
    // --------------------------------------------------

    if (url.pathname === "/api/health") {
      return Response.json({
        status: "ok",
        service: "Streamix API",
        tmdbConfigured: Boolean(env.TMDB_READ_ACCESS_TOKEN)
      });
    }

    // --------------------------------------------------
    // TMDB SEARCH
    // --------------------------------------------------

    if (url.pathname === "/api/tmdb/search") {
      const query = url.searchParams.get("query");
      const type = url.searchParams.get("type") || "multi";

      if (!query) {
        return Response.json(
          {
            error: "Missing search query"
          },
          { status: 400 }
        );
      }

      if (!env.TMDB_READ_ACCESS_TOKEN) {
        return Response.json(
          {
            error: "TMDB Read Access Token is not configured."
          },
          { status: 500 }
        );
      }

      // Choose the correct TMDB endpoint.
      let endpoint =
        "https://api.themoviedb.org/3/search/multi";

      if (type === "movie") {
        endpoint =
          "https://api.themoviedb.org/3/search/movie";
      }

      if (type === "tv") {
        endpoint =
          "https://api.themoviedb.org/3/search/tv";
      }

      // Build the TMDB request.
      const tmdbUrl = new URL(endpoint);

      tmdbUrl.searchParams.set("query", query);
      tmdbUrl.searchParams.set("language", "en-US");
      tmdbUrl.searchParams.set("include_adult", "false");

      // Send the request to TMDB.
      // IMPORTANT:
      // The token stays inside Cloudflare.
      // It is NEVER sent to the browser.
      const response = await fetch(tmdbUrl.toString(), {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${env.TMDB_READ_ACCESS_TOKEN}`,
          accept: "application/json"
        }
      });

      // If TMDB returns an error, pass a useful
      // error back to Streamix.
      if (!response.ok) {
        const errorText = await response.text();

        return Response.json(
          {
            error: "TMDB request failed",
            status: response.status,
            details: errorText
          },
          { status: response.status }
        );
      }

      // Convert TMDB's response to JSON.
      const data = await response.json();

      // Return the TMDB results to Streamix.
      return Response.json(data);
    }

    // --------------------------------------------------
    // TMDB MOVIE DETAILS
    // --------------------------------------------------

    if (url.pathname.startsWith("/api/tmdb/movie/")) {
      const movieId =
        url.pathname.split("/").pop();

      if (!movieId) {
        return Response.json(
          {
            error: "Missing movie ID"
          },
          { status: 400 }
        );
      }

      const tmdbUrl =
        `https://api.themoviedb.org/3/movie/${movieId}`;

      const response = await fetch(tmdbUrl, {
        headers: {
          Authorization:
            `Bearer ${env.TMDB_READ_ACCESS_TOKEN}`,
          accept: "application/json"
        }
      });

      const data = await response.json();

      return Response.json(data, {
        status: response.status
      });
    }

    // --------------------------------------------------
    // TMDB TV DETAILS
    // --------------------------------------------------

    if (url.pathname.startsWith("/api/tmdb/tv/")) {
      const tvId =
        url.pathname.split("/").pop();

      if (!tvId) {
        return Response.json(
          {
            error: "Missing TV ID"
          },
          { status: 400 }
        );
      }

      const tmdbUrl =
        `https://api.themoviedb.org/3/tv/${tvId}`;

      const response = await fetch(tmdbUrl, {
        headers: {
          Authorization:
            `Bearer ${env.TMDB_READ_ACCESS_TOKEN}`,
          accept: "application/json"
        }
      });

      const data = await response.json();

      return Response.json(data, {
        status: response.status
      });
    }

    // --------------------------------------------------
    // NOT FOUND
    // --------------------------------------------------

    return new Response("Not Found", {
      status: 404
    });
  }
};
