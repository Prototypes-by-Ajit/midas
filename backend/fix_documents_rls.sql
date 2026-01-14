-- Fix RLS policy for documents table
-- This allows authenticated users to read all documents

-- Drop the old restrictive policy if it exists
DROP POLICY IF EXISTS "Authenticated can read documents" ON public.documents;

-- Create new policy that allows all authenticated users to read documents
CREATE POLICY "Authenticated can read all documents"
ON public.documents
FOR SELECT
TO authenticated
USING (true);

-- Verify the policy
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'documents';
