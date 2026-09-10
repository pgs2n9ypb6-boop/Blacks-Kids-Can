// History targets: each is a bumper on the table tied to a real figure.
// Kept small for the core-loop pass - more will be added once the physics
// loop is solid and this moves past prototype stage.
const HISTORY_TARGETS = [
  {
    id: 'jemison',
    name: 'Mae Jemison',
    emoji: '🚀',
    fact: 'First Black woman to travel into space, aboard the Space Shuttle Endeavour in 1992.',
    xp: 500,
    color: '#2A2060'
  },
  {
    id: 'tubman',
    name: 'Harriet Tubman',
    emoji: '🧭',
    fact: 'Escaped slavery, then returned again and again to help others reach freedom.',
    xp: 500,
    color: '#1F7A5C'
  },
  {
    id: 'carver',
    name: 'G.W. Carver',
    emoji: '🌱',
    fact: 'Agricultural scientist who found hundreds of new uses for crops like peanuts.',
    xp: 400,
    color: '#E8622C'
  },
  {
    id: 'robinson',
    name: 'Jackie Robinson',
    emoji: '⚾',
    fact: 'Broke Major League Baseball\'s color barrier in 1947 with the Brooklyn Dodgers.',
    xp: 400,
    color: '#F2B705'
  },
  {
    id: 'parks',
    name: 'Rosa Parks',
    emoji: '🚌',
    fact: 'Her refusal to give up her bus seat helped spark the Montgomery Bus Boycott.',
    xp: 450,
    color: '#C0392B'
  }
];
