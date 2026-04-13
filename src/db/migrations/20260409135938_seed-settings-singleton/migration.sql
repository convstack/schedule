INSERT INTO settings (id, convention_name, convention_tz)
VALUES ('singleton', 'Convention', 'UTC')
ON CONFLICT (id) DO NOTHING;
