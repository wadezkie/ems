-- New task statuses for the employee progress / manager review flow.
-- for_review: employee submitted progress for the manager to check.
-- needs_revision: manager returned the task with feedback.
alter type public.task_status add value if not exists 'for_review' after 'in_progress';
alter type public.task_status add value if not exists 'needs_revision' after 'for_review';
