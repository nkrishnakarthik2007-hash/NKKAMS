create unique index if not exists one_pending_reset_request_per_user
on public.password_reset_requests(requester_user_id) where status='pending';