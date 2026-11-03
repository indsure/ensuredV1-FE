-- Undo 035: remove the entry ages from the live catalogue. The seed files keep them.
UPDATE public.policy_catalog SET profile = profile - 'entry_age' WHERE profile ? 'entry_age';
