export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  const leagueId = String(req.query.id || "").trim();
  const page = Math.max(
    1,
    Math.min(100, Number.parseInt(req.query.page || "1", 10) || 1)
  );

  if (!/^\d+$/.test(leagueId)) {
    return res.status(400).json({
      success: false,
      error: "Enter a valid numeric FPL league ID."
    });
  }

  try {
    const url =
      "https://fantasy.premierleague.com/api/leagues-classic/" +
      leagueId +
      "/standings/?page_standings=" +
      page;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "FPL-Gameweek-Hub/1.0",
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error:
          response.status === 404
            ? "League not found. Check the league ID."
            : "The official FPL service could not return the standings."
      });
    }

    const data = await response.json();
    const standings = data.standings || {};

    const managers = (standings.results || []).map((item) => ({
      rank: item.rank,
      manager: item.player_name,
      team: item.entry_name,
      gwPoints: item.event_total,
      totalPoints: item.total,
      entry: item.entry
    }));

    return res.status(200).json({
      success: true,
      league: data.league || {},
      page: page,
      hasNext: Boolean(standings.has_next),
      managers: managers
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Unable to retrieve the league standings. Please try again."
    });
  }
}
