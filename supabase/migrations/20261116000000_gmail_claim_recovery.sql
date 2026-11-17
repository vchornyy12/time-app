-- Track when a message was claimed for analysis so claims abandoned by a
-- killed worker can be detected and retried.
-- Apply while no Gmail scan is running.
BEGIN;

ALTER TABLE public.gmail_processed_messages
  ADD COLUMN claimed_at timestamptz;

-- Before this change, analyzed messages that produced no suggestion were left
-- in 'processing' instead of 'processed'. They cannot be told apart from
-- claims lost to an interrupted worker, so settle both as processed rather
-- than re-send already analyzed mail to the model. Rows with a suggestion are
-- awaiting the user's review and keep their state.
UPDATE public.gmail_processed_messages AS message
SET status = 'processed', processed_at = now()
WHERE message.status = 'processing'
  AND NOT EXISTS (
    SELECT 1 FROM public.gmail_task_suggestions AS suggestion
    WHERE suggestion.user_id = message.user_id
      AND suggestion.account_email = message.account_email
      AND suggestion.message_id = message.message_id
  );

CREATE INDEX gmail_claimed_messages
  ON public.gmail_processed_messages (user_id, account_email, claimed_at)
  WHERE status = 'processing';

COMMIT;
