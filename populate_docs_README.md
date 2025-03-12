# Populating the Supabase Docs Table

This README explains how to populate your Supabase docs table with data from the Alberta Open Data API.

## Issue

The original script `populate_supabase_docs.js` was failing with a Row-Level Security (RLS) error:

```
new row violates row-level security policy for table "docs"
```

This happens because the anonymous role doesn't have permission to insert into the docs table.

## Solution

There are two main approaches to solve this issue:

### 1. Add RLS Policies (Recommended)

The SQL migration file `supabase/migrations/20250312050000_add_docs_rls_policies.sql` adds RLS policies to allow:
- Admin users to read, insert, update, and delete from the docs table
- Service role to bypass RLS for the docs table

To apply these policies:

1. Go to the Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `supabase/migrations/20250312050000_add_docs_rls_policies.sql`
4. Run the SQL

### 2. Use the Service Role Key

The script `populate_supabase_docs_service_role.js` is a modified version that uses the Supabase service role key instead of the anonymous key.

To use this script:

1. Get your service role key from the Supabase dashboard (Project Settings > API)
2. Edit `populate_supabase_docs_service_role.js` and replace `YOUR_SERVICE_ROLE_KEY` with your actual service role key
3. Run the script with `node run_populate_service_role.js`

Alternatively, you can create a `.env` file with the following content:

```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

And then modify the `populate_supabase_docs_service_role.js` file to use this environment variable:

```javascript
import dotenv from 'dotenv';
dotenv.config();

const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
```

## Running the Script

To run the script with a limit of 10 packages:

```
node run_populate_service_role.js
```

To run with a custom limit (e.g., 50 packages):

```
node populate_supabase_docs_service_role.js 50
```

## Troubleshooting

If you encounter errors:

1. Check that your Supabase URL and service role key are correct
2. Verify that the docs table exists and has the expected schema
3. Check the Supabase logs for any errors
4. Make sure all required dependencies are installed (`npm install`)

## Fixed Issues

### Command-line Arguments Not Working

The original script had an issue where command-line arguments (like the limit parameter) weren't being properly recognized when running with a specific limit:

```
node populate_supabase_docs_service_role.js 35000
```

This was due to a path format difference in the condition that checks if the script is being run directly. The fix was to remove the condition and always use the command-line argument.

The script now correctly processes the specified number of packages (up to the total available).
