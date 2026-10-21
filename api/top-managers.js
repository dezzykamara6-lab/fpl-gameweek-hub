export default async function handler(req, res) {
  try {
    const pages = [1, 2];
    const allManagers = [];

    for (const page of pages) {
      const response = await fetch(
        `https://fantasy.premierleague.com/api/leagues-classic/314/standings/?page=${page}`
      );

      if (!response.ok) {
        throw new Error(`FPL API returned status ${response.status}`);
      }

      const data = await response.json();
      const managers = data?.standings?.results ?? [];

      allManagers.push(...managers);
    }

    // Remove duplicate entries using each manager's unique FPL ID.
    const uniqueManagers = [
      ...new Map(
        allManagers.map(manager => [manager.entry, manager])
      ).values()
    ];

    // Sort by gameweek points, highest first.
    uniqueManagers.sort(
      (a, b) => b.event_total - a.event_total
    );

    const top50 = uniqueManagers.slice(0, 50).map((manager, index) => ({
      rank: index + 1,
      manager: manager.player_name,
      team: manager.entry_name,
      gwPoints: manager.event_total,
      totalPoints: manager.total,
      entry: manager.entry
    }));

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

    return res.status(200).json({
      success: true,
      updated: new Date().toISOString(),
      managers: top50
    });

  } catch (error) {
    console.error("Top managers API error:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to fetch FPL data"
    });
  }
}
