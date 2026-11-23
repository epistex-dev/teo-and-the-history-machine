export const ORDER = [
  'intro', 'saturnalia', 'yule', 'mistletoe', 'bethlehem', 'dec25', 'nicholas',
  'carol', 'krampus', 'befana', 'tree', 'ban1647', 'silent-night',
  'yule-lads', 'yule-cat', 'santa-ny', 'caga-tio', 'dickens', 'brooms',
  'ending',
] as const;

/** The scene id a save holds once the player is on the end screen; no chapter may name a scene so. */
export const END_SCENE = 'end';

export const indexOf = (id: string): number => (ORDER as readonly string[]).indexOf(id);
