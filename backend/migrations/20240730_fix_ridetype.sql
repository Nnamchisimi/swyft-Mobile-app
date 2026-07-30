-- Allow ride_type to store both city hub ids and intercity route ids in the same column
ALTER TABLE rides ALTER COLUMN ride_type TYPE VARCHAR(50) USING ride_type::text;
DROP TYPE IF EXISTS ride_type CASCADE;
