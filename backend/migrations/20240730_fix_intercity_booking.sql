-- Fix ride_type to support intercity routes and add inter_city flag

ALTER TABLE rides ALTER COLUMN ride_type TYPE VARCHAR(50) USING ride_type::text;

DROP TYPE IF EXISTS ride_type CASCADE;

ALTER TABLE rides ADD COLUMN IF NOT EXISTS inter_city BOOLEAN DEFAULT FALSE;

UPDATE rides SET inter_city = (ride_type LIKE '%-%') WHERE inter_city IS NULL;

CREATE INDEX IF NOT EXISTS idx_rides_inter_city ON rides(inter_city);
