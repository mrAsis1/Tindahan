# Customer duplicate checks

New Customer and the inline customer form in Add Utang show matching names with a **Use existing** button. Selecting a customer opens their history or returns them to the unfinished utang form.

A new customer is rejected when name, contact number and identifying note all match an existing customer in the same store, ignoring case and repeated/outer whitespace. Different people with the same name can use distinct contact details or an identifying note. This does not identify spelling variations or differently formatted phone numbers as duplicates.

The local repository checks inside its write lock. Supabase migration `20260913090000_customer_duplicate_guard.sql` checks inside the existing owner transaction lock, preserving same-request retries and audit behavior. Existing duplicate customers and their histories are preserved; this change does not merge or delete records.

## Hosted rollout

The new migration has been tested locally but has not been applied to either hosted project. Follow [Supabase setup](supabase-setup.md) to verify the target and dry run before applying it to development. Verify the Preview customer flow with fictional data, then include the migration in a checked release for the store project. The browser check alone cannot prevent simultaneous duplicate requests from different devices until the database migration is applied.
