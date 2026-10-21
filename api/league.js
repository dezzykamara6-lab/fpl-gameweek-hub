export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const id = String(req.query.id || "").trim();
  const page = Math.max(
    1,
    Math.min(100, Number.parseInt(req.query.page || "1", 10) || 1)
  );

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      success: false,
      error: "Enter a valid numeric FPL league ID."
    });
  }

  try {
    const response = await fetch(
      `https://fantasy.premierleague.com/api/leagues-classic/${id}/standings/?page_standings=${page}`
    );

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Could not retrieve this league. Check the league ID."
      });
    }

    const data = await response.json();
    const standings = data.standings || {};

    return res.status(200).json({
      success: true,
      league: data.league || {},
      page,
      hasNext: Boolean(standings.has_next),
      managers: (standings.results || []).map(item => ({
        rank: item.rank,
        manager: item.player_name,
        team: item.entry_name,
        gwPoints: item.event_total,
        totalPoints: item.total,
        entry: item.entry
      }))
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Unable to retrieve league standings."
    });
  }
}
