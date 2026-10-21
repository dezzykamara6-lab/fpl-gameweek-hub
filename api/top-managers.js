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
    const event = bootstrap.events.find(item => item.id === gameweek);

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
    let leagueName = "";
    let previousPageSignature = "";
    const seenPages = new Set();

    // Read standings pages until the API says there are no more.
    while (page <= 200) {
      const url =
        `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/?page_standings=${page}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Could not load league standings (page ${page}).`
        );
      }

      const data = await response.json();
      const standings = data.standings;
      const managers = standings?.results || [];

      if (page === 1) {
        leagueName = data.league?.name || "Mini-League";
      }

      if (managers.length === 0) {
        break;
      }

      const signature = managers
        .map(manager => manager.entry)
        .join(",");

      // Stop if the API repeats a page.
      if (seenPages.has(signature) || signature === previousPageSignature) {
        break;
      }

      seenPages.add(signature);
      previousPageSignature = signature;
      allManagers.push(...managers);

      if (standings?.has_next !== true) {
        break;
      }

      page++;
    }

    if (allManagers.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No managers found. Check the mini-league ID."
      });
    }

    // Retrieve each manager's points for the selected Gameweek.
    const results = await Promise.all(
      allManagers.map(async manager => {
        try {
          const response = await fetch(
            `https://fantasy.premierleague.com/api/entry/${manager.entry}/event/${gameweek}/picks/`
          );

          if (!response.ok) {
            return null;
          }

          const data = await response.json();
          const history = data.entry_history;

          if (!history || history.points == null) {
            return null;
          }

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
    let rank = 0;

    const rankedManagers = sorted.map((manager, index) => {
      if (manager.gwPoints !== previousPoints) {
        rank = index + 1;
        previousPoints = manager.gwPoints;
      }

      return {
        rank,
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
      pagesRead: page,
      updated: new Date().toISOString(),
      managers: rankedManagers
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to load Gameweek results."
    });
  }
}
