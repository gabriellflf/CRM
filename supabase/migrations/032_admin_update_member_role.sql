-- Allow admins and owners to update account_role on profiles within their account.
-- Previously only the "Users can update own profile" policy existed (auth.uid() = user_id),
-- which silently blocked owners/admins from changing roles via the Equipe page.
CREATE POLICY "Admins can update member roles" ON profiles
  FOR UPDATE
  USING (
    account_id IS NOT NULL
    AND is_account_member(account_id, 'admin')
  )
  WITH CHECK (
    account_id IS NOT NULL
    AND is_account_member(account_id, 'admin')
  );
