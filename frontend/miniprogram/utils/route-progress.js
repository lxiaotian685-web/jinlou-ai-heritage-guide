function buildRouteProgress(route, sitePoints, visitedSpotIds) {
  if (!route) return null;
  const visited = new Set(visitedSpotIds);
  const points = (route.points || []).map((point) => {
    const sitePoint = sitePoints.find((item) => item.number === point.siteNumber);
    const spotId = sitePoint?.spotId || '';
    return { ...point, spotId, isVisited: Boolean(spotId && visited.has(spotId)) };
  });
  const currentIndex = points.findIndex((point) => !point.isVisited);
  const completedCount = points.filter((point) => point.isVisited).length;
  const isComplete = points.length > 0 && currentIndex === -1;
  const currentStop = currentIndex >= 0 ? { ...points[currentIndex], isCurrent: true } : null;
  const nextStop = currentIndex >= 0
    ? points.slice(currentIndex + 1).find((point) => !point.isVisited) || null
    : null;
  return {
    points: points.map((point, index) => ({ ...point, isCurrent: index === currentIndex })),
    completedCount,
    totalCount: points.length,
    progressPercent: points.length ? Math.round(completedCount / points.length * 100) : 0,
    isComplete,
    currentStop,
    nextStop,
  };
}

module.exports = { buildRouteProgress };
