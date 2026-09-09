// ContentEngine: loads content JSON once and serves filtered views of it.
// Adding a new age level later means adding JSON entries with that ageLevel
// tag - no code changes required here.
const ContentEngine = (() => {
  let figures = [];
  let challenges = [];
  let locations = [];
  let badges = [];
  let careers = [];
  let loaded = false;

  async function loadAll() {
    if (loaded) return;
    const [f, c, l, b, careersData] = await Promise.all([
      fetch('content/figures.json').then(r => r.json()),
      fetch('content/challenges.json').then(r => r.json()),
      fetch('content/locations.json').then(r => r.json()),
      fetch('content/badges.json').then(r => r.json()),
      fetch('content/careers.json').then(r => r.json())
    ]);
    figures = f; challenges = c; locations = l; badges = b; careers = careersData;
    loaded = true;
  }

  const getFigure = (id) => figures.find(x => x.id === id);
  const getFiguresByIds = (ids) => ids.map(getFigure).filter(Boolean);
  const getLocation = (id) => locations.find(x => x.id === id);
  const getLocationsByWorld = (world) => locations.filter(x => x.world === world).sort((a, b) => a.order - b.order);
  const getAllLocationsOrdered = () => [...locations].sort((a, b) => a.world - b.world || a.order - b.order);
  const getWorldNumbers = () => [...new Set(locations.map(l => l.world))].sort((a, b) => a - b);
  const getBadge = (id) => badges.find(x => x.id === id);
  const getAllBadges = () => badges;
  const getAllCareers = () => careers;
  const getChallenges = () => challenges;
  const getRandomChallenge = (excludeIds = [], ageLevel = '5-8') => {
    const byAge = challenges.filter(c => (c.ageLevel || '5-8') === ageLevel);
    const source = byAge.length ? byAge : challenges;
    const pool = source.filter(c => !excludeIds.includes(c.id));
    const finalPool = pool.length ? pool : source;
    return finalPool[Math.floor(Math.random() * finalPool.length)];
  };

  return {
    loadAll, getFigure, getFiguresByIds, getLocation, getLocationsByWorld, getAllLocationsOrdered, getWorldNumbers,
    getBadge, getAllBadges, getAllCareers, getChallenges, getRandomChallenge
  };
})();
