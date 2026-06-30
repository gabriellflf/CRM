-- Tighten the admin role-change policy: admins may not set account_role = 'owner'.
-- The WITH CHECK clause validates the NEW row values being written.
DROP POLICY IF EXISTS "Admins can update member roles" ON profiles;

CREATE POLICY "Admins can update member roles" ON profiles
  FOR UPDATE
  USING (
    account_id IS NOT NULL
    AND is_account_member(account_id, 'admin')
  )
  WITH CHECK (
    account_id IS NOT NULL
    AND is_account_member(account_id, 'admin')
    AND account_role <> 'owner'
  );
