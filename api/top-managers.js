export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  const leagueId = String(req.query.leagueId || "945612");
  const gameweek = Number.parseInt(req.query.gw || "6", 10);

  if (!/^\d+$/.test(leagueId)) {
    return res.status(400).json({
      success: false,
      error: "Invalid mini-league ID."
    });
  }

  if (!Number.isInteger(gameweek) || gameweek < 1 || gameweek > 38) {
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
    const event = bootstrap.events.find(e => e.id === gameweek);

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

    let allManagers = [];
    let page = 1;
    let hasNext = true;
    let leagueName = "";

    while (hasNext) {
      const url =
        `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/?page_standings=${page}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Could not load mini-league standings.");
      }

      const data = await response.json();

      leagueName = data.league?.name || leagueName;

      const managers = data.standings?.results || [];
      allManagers.push(...managers);

      hasNext = Boolean(data.standings?.has_next);
      page++;

      if (page > 100) {
        throw new Error("Too many league pages to process.");
      }
    }

    if (allManagers.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No managers found in this mini-league."
      });
    }

    const results = await Promise.all(
      allManagers.map(async manager => {
        try {
          const response = await fetch(
            `https://fantasy.premierleague.com/api/entry/${manager.entry}/event/${gameweek}/picks/`
          );

          if (!response.ok) return null;

          const data = await response.json();
          const history = data.entry_history;

          if (!history || history.points == null) return null;

          return {
            manager: manager.player_name,
            team: manager.entry_name,
            entry: manager.entry,
            gwPoints: history.points,
            totalPoints: manager.total
          };
        } catch {
          return null;
        }
      })
    );

    const sorted = results
      .filter(Boolean)
      .sort((a, b) => b.gwPoints - a.gwPoints);

    let previousPoints = null;
    let currentRank = 0;

    const rankedManagers = sorted.map((manager, index) => {
      if (manager.gwPoints !== previousPoints) {
        currentRank = index + 1;
        previousPoints = manager.gwPoints;
      }

      return {
        rank: currentRank,
        ...manager
      };
    });

    return res.status(200).json({
      success: true,
      finished: true,
      league: leagueName,
      leagueId,
      gameweek,
      managerCount: rankedManagers.length,
      updated: new Date().toISOString(),
      managers: rankedManagers
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message ||
        "Unable to load Gameweek results. Please try again."
    });
  }
        }
