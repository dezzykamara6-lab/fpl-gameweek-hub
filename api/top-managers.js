export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  const gameweek = Number.parseInt(req.query.gw || "1", 10);

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
      throw new Error("Could not retrieve Gameweek information.");
    }

    const bootstrap = await bootstrapResponse.json();
    const selectedEvent = bootstrap.events.find(
      event => event.id === gameweek
    );

    if (!selectedEvent) {
      return res.status(400).json({
        success: false,
        error: "That Gameweek does not exist."
      });
    }

    if (!selectedEvent.finished) {
      return res.status(400).json({
        success: false,
        error: `Gameweek ${gameweek} has not finished yet.`
      });
    }

    const managersMap = new Map();

    for (const page of [1, 2]) {
      const response = await fetch(
        `https://fantasy.premierleague.com/api/leagues-classic/314/standings/?page_standings=${page}`
      );

      if (!response.ok) {
        throw new Error("Could not retrieve league standings.");
      }

      const data = await response.json();

      for (const item of data.standings?.results || []) {
        managersMap.set(item.entry, {
          manager: item.player_name,
          team: item.entry_name,
          entry: item.entry,
          totalPoints: item.total
        });
      }
    }

    const managers = await Promise.all(
      Array.from(managersMap.values()).map(async manager => {
        const response = await fetch(
          `https://fantasy.premierleague.com/api/entry/${manager.entry}/event/${gameweek}/picks/`
        );

        if (!response.ok) {
          return {
            ...manager,
            gwPoints: null
          };
        }

        const data = await response.json();

        return {
          ...manager,
          gwPoints: data.entry_history?.points ?? null
        };
      })
    );

    const rankedManagers = managers
      .filter(manager => manager.gwPoints !== null)
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
      gameweek,
      gameweekName: `Gameweek ${gameweek}`,
      updated: new Date().toISOString(),
      managers: rankedManagers
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Unable to load Gameweek results. Please try again."
    });
  }
             }
