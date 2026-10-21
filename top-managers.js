export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const pages = [1, 2];
    const uniqueManagers = new Map();

    for (const page of pages) {
      const url =
        "https://fantasy.premierleague.com/api/leagues-classic/314/standings/?page_standings=" +
        page;

      const response = await fetch(url, {
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error("FPL standings request failed.");
      }

      const data = await response.json();
      const results = data.standings?.results || [];

      for (const item of results) {
        uniqueManagers.set(item.entry, {
          rank: item.rank,
          manager: item.player_name,
          team: item.entry_name,
          gwPoints: item.event_total,
          totalPoints: item.total,
          entry: item.entry
        });
      }
    }

    const managers = Array.from(uniqueManagers.values())
      .sort((a, b) => b.gwPoints - a.gwPoints)
      .slice(0, 50)
      .map((manager, index) => ({
        ...manager,
        rank: index + 1
      }));

    return res.status(200).json({
      success: true,
      updated: new Date().toISOString(),
      managers
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Unable to load the leaderboard. Please try again."
    });
  }
}
