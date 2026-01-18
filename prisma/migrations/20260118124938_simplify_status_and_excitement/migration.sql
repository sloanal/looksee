-- Migration to simplify status and excitement options
-- Status: Reduce to "HAVE_NOT_SEEN" and "ALREADY_SEEN"
-- Excitement: Reduce to 1, 3, 5 only (map 2->1, 4->5)

-- Update status values
UPDATE "UserMediaPreference"
SET status = 'HAVE_NOT_SEEN'
WHERE status IN ('NOT_SEEN_WANT', 'NOT_SEEN_DONT_WANT');

UPDATE "UserMediaPreference"
SET status = 'ALREADY_SEEN'
WHERE status IN ('SEEN_WOULD_REWATCH', 'SEEN_WONT_REWATCH');

-- Update excitement values
-- Map 2 -> 1 (Not excited)
UPDATE "UserMediaPreference"
SET excitement = 1
WHERE excitement = 2;

-- Map 4 -> 5 (Excited)
UPDATE "UserMediaPreference"
SET excitement = 5
WHERE excitement = 4;

-- Note: excitement values 1, 3, 5 remain unchanged
