-- Fix session_id type to be TEXT instead of UUID for compatibility

ALTER TABLE file_changes ALTER COLUMN session_id TYPE TEXT;
ALTER TABLE workspace_actions ALTER COLUMN session_id TYPE TEXT;