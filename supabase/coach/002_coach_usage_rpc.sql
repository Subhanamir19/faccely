-- ============================================================================
-- Coach — atomic usage counter (step 2 of 2)
--
-- HOW TO RUN THIS
--   Run 001_coach_tables.sql first. Then, in the same place:
--   Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
--   "Success. No rows returned." is the correct result.
--
-- Safe to run more than once.
--
-- WHY THIS EXISTS
--   Adding up a user's weekly usage from the backend would mean: read the row,
--   add to it, write it back. If two of the user's messages finish at the same
--   moment, both read the same starting number and one of the two updates is
--   lost — the user gets free messages and the cost report under-reports.
--
--   Doing the addition inside the database makes it one indivisible step, so
--   counts stay correct no matter how the requests overlap.
-- ============================================================================

create or replace function public.coach_record_usage(
  p_user_id      text,
  p_period_start date,
  p_day          text,
  p_tokens_in    bigint,
  p_tokens_out   bigint,
  p_cost_usd     numeric,
  p_messages     integer,
  p_images       integer
)
returns public.coach_usage
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.coach_usage;
begin
  insert into public.coach_usage as u (
    user_id,
    period_start,
    tokens_in,
    tokens_out,
    messages_count,
    images_count,
    cost_usd,
    day_counts,
    updated_at
  )
  values (
    p_user_id,
    p_period_start,
    greatest(p_tokens_in, 0),
    greatest(p_tokens_out, 0),
    greatest(p_messages, 0),
    greatest(p_images, 0),
    greatest(p_cost_usd, 0),
    case
      when p_messages > 0 then jsonb_build_object(p_day, p_messages)
      else '{}'::jsonb
    end,
    now()
  )
  on conflict (user_id, period_start) do update
    set tokens_in      = u.tokens_in      + greatest(p_tokens_in, 0),
        tokens_out     = u.tokens_out     + greatest(p_tokens_out, 0),
        messages_count = u.messages_count + greatest(p_messages, 0),
        images_count   = u.images_count   + greatest(p_images, 0),
        cost_usd       = u.cost_usd       + greatest(p_cost_usd, 0),
        -- Add today's messages to whatever this day already held.
        day_counts     = u.day_counts || jsonb_build_object(
                           p_day,
                           coalesce((u.day_counts ->> p_day)::int, 0) + greatest(p_messages, 0)
                         ),
        updated_at     = now()
  returning * into result;

  return result;
end;
$$;

-- The backend calls this with the service-role key. No other role may.
revoke all on function public.coach_record_usage(
  text, date, text, bigint, bigint, numeric, integer, integer
) from public, anon, authenticated;
