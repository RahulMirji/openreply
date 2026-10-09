-- Adds optional password support alongside the existing magic-link sign in.
-- Nullable on purpose: existing users have no password and keep using magic
-- links until they set one from Settings.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
