DELETE FROM "expedition_blobs"
WHERE "key" NOT LIKE 'srv-%'
  AND "key" NOT IN ('nav', 'progress', 'hero-store');
