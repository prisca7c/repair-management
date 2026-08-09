-- ----------------------------------------------------------------------------
-- "Waiting" has been retired as a status in the app (staff can no longer set
-- it, and it no longer shows as a dashboard counter). This just moves any
-- existing repairs that were sitting in "waiting" back to "received" so
-- they don't get lost. Safe to re-run.
-- ----------------------------------------------------------------------------

update public.repairs set status = 'received' where status = 'waiting';
