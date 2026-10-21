export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  const leagueId = String(req.query.leagueId || "314");
  const gameweek = Number.parseInt(req.query.gw || "1", 10);

  if (!/^\d+$/.test(leagueId)) {
    return res.status(400).json({
      success: false,
      error: "Enter a valid mini-league ID."
    });
  }

  if (
    !Number.isInteger(gameweek) ||
    gameweek < 1 ||
    gameweek > 38
  ) {
    return res.status(400).json({
      success: false,
      error: "Choose a Gameweek between 1 and 38."
    });
  }

  try {
    const bootstrapResponse = await fetch(
      "https://fantasy.premierleague.com/api/bootstrap-static/"
    );

    if (!bootstrapResponse.ok) {
      throw new Error("Could not load FPL information.");
    }

    const bootstrap = await bootstrapResponse.json();

    const event = bootstrap.events.find(
      item => item.id === gameweek
    );

    if (!event) {
      return res.status(400).json({
        success: false,
        error: "Gameweek not found."
      });
    }

    if (!event.finished) {
      return res.status(200).json({
        success: true,
        finished: false,
        gameweek,
        message: `Gameweek ${gameweek} has not finished yet.`,
        managers: []
      });
    }

    const leagueResponse = await fetch(
      `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/?page_standings=1`
    );

    if (!leagueResponse.ok) {
      return res.status(404).json({
        success: false,
        error: "Mini-league not found or standings unavailable."
      });
    }

    const leagueData = await leagueResponse.json();

    const league = leagueData.league;
    const results = leagueData.standings?.results || [];

    if (!league || results.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No managers found in this mini-league."
      });
    }

    const managers = await Promise.all(
      results.map(async item => {
        try {
          const response = await fetch(
            `https://fantasy.premierleague.com/api/entry/${item.entry}/event/${gameweek}/picks/`
          );

          if (!response.ok) {
            return null;
          }

          const data = await response.json();

          const gwPoints =
            data.entry_history?.points;

          if (gwPoints == null) {
            return null;
          }

          return {
            manager: item.player_name,
            team: item.entry_name,
            entry: item.entry,
            gwPoints,
            totalPoints: item.total
          };
        } catch {
          return null;
        }
      })
    );

    const rankedManagers = managers
      .filter(Boolean)
      .sort((a, b) => b.gwPoints - a.gwPoints)
      .map((manager, index, array) => ({
        rank:
          index > 0 &&
          manager.gwPoints === array[index - 1].gwPoints
            ? array[index - 1].rank
            : index + 1,
        ...manager
      }));

    return res.status(200).json({
      success: true,
      finished: true,
      league: league.name,
      leagueId,
      gameweek,
      updated: new Date().toISOString(),
      managers: rankedManagers
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Unable to load results. Please try again."
    });
  }
}
