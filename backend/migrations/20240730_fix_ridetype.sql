-- Allow ride_type to store both city hub ids and intercity route ids

ALTER TABLE rides ALTER COLUMN ride_type TYPE VARCHAR(50) USING ride_type::text;
