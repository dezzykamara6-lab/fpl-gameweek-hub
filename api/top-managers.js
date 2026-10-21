export default async function handler(req, res) {
  try {
    // Fetch first 2 pages of the Overall League (314)
    const pages = [1, 2];
    let allManagers = [];

    for (const page of pages) {
      const response = await fetch(
        `https://fantasy.premierleague.com/api/leagues-classic/314/standings/?page=${page}`
      );
      const data = await response.json();
      allManagers = allManagers.concat(data.standings.results);
    }

    // Sort by current gameweek points (event_total)
    allManagers.sort((a, b) => b.event_total - a.event_total);

    // Take top 50
    const top50 = allManagers.slice(0, 50).map((m, index) => ({
      rank: index + 1,
      manager: m.player_name,
      team: m.entry_name,
      gwPoints: m.event_total,
      totalPoints: m.total,
      entry: m.entry
    }));

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({
      success: true,
      updated: new Date().toISOString(),
      managers: top50
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch FPL data"
    });
  }
}
