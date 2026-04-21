
## **Summary of Changes**

1. **CKAN URL Management:**  
   - Any authenticated user can add a CKAN URL after client-side validation (ensuring it’s a live CKAN instance).
   - **Only admin users** can remove data source URLs.

2. **Client-side Data Processing:**  
   - Users’ browsers fetch, embed, and prepare data locally.
   - The browser uses an edge function to write each processed entry to the database.
   - Abuse is limited, since the “heavy lifting” must occur on the client.

3. **URL Validation:**  
   - Before saving a new CKAN data source, the browser does:  
      - A GET to `${url}/api/3/action/site_read` to confirm the CKAN API responds as expected.
   - If the validation fails, the source isn't committed.

4. **Supabase Auth/Keys Modernization:**  
   - Replace all historical service_role/anon keys in the frontend with the new Supabase `publishable` key.
   - Use the secret key *only* in secured backend environments (e.g., edge functions).
   - All client calls must use `createBrowserClient` or `createPagesServerClient` as appropriate (never `createClient` with a secret or service_role key).

---

## **1. Database RLS and API Policies**

```sql
-- Everyone can read CKAN sources and docs
CREATE POLICY "Public can read" ON data_sources FOR SELECT USING (true);
CREATE POLICY "Public can read docs" ON docs_meta FOR SELECT USING (true);

-- Any authenticated user can add a CKAN url (after validation in UI)
CREATE POLICY "Authenticated can insert sources" ON data_sources FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Only admins can delete or update sources
CREATE POLICY "Admins can delete sources" ON data_sources FOR DELETE USING (EXISTS (
  SELECT 1 FROM auth.users WHERE id = auth.uid() AND is_admin = TRUE
));
CREATE POLICY "Admins can update sources" ON data_sources FOR UPDATE USING (EXISTS (
  SELECT 1 FROM auth.users WHERE id = auth.uid() AND is_admin = TRUE
));

-- Docs writing (insert only, by anyone authenticated)
CREATE POLICY "Authenticated can write docs" ON docs_meta FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Reject deletes/updates by non-admins
REVOKE DELETE ON docs_meta FROM authenticated; 
REVOKE UPDATE ON docs_meta FROM authenticated;
```

- The above assumes you track admin users with a flag (`is_admin` or similar) in your `auth.users` table or in a custom roles mapping.

---

## **2. Client-Side CKAN URL Validation (Svelte Example)**

```typescript name=src/lib/utils/ckan.ts
export async function validateCKANUrl(url: string): Promise<boolean> {
  // Ensure URL is well-formed and responds to CKAN's "site_read"
  try {
    const safeUrl = url.replace(/\/+$/, ''); // Remove trailing slash
    const response = await fetch(`${safeUrl}/api/3/action/site_read`, { method: "GET" });
    if (!response.ok) return false;
    const json = await response.json();
    return json.success === true && json.result['site_title'] !== undefined;
  } catch (e) {
    return false;
> **Note:**  
>
> - Only admins can remove data sources.  
> - All data sources and their indexed datasets are public.
> - Data processing (fetching and embedding) MUST be performed on the client (browser), NOT the backend.
> - You must be logged in to add a source or contribute new indices.
> - CKAN URLs are strictly validated before being recorded.

---

## **Recap:**

- No service_key/anon_key in browser.  
- Data processing happens in-browser, one-by-one, as initiated by the user.  
- Auth'd users add (but cannot remove) sources—only admins can delete.  
- Client validates CKAN URL before saving.
- The edge function (or direct insert) simply stores a trusted row, not bulk dataset processing.

Let me know if you want “admin” logic or UI as well, or further details on front-end embedding/processing patterns!

---

## **7. Architectural Updates (April 2026)**

### Security Re-Evaluation
A chatbot suggested moving vector generation and metadata fetching into an Edge Function to avoid client-side spoofing (SSRF/Fake Vectors). We debated this and determined that **our Trusted Maintainer protocol paired with Admin Approval provides sufficient security.** Because vectors can only be inserted by explicit approval:
- Compute cost remains at zero for the server (the browser still generates embeddings natively using Transformers.js).
- If a trusted maintainer maliciously submits fake vectors to their own approved CKAN site, the Admin simply clicks "Revoke Approval" and `DELETE`s the poisoned rows via the Admin UI.
- No heavy, RAM-crashing Edge Functions required.

### Geo-Location and Frontend Filtering
To transition from a strictly "Alberta Open Data" site to a global CKAN search engine:
1. **Dynamic Dropdown**: The static header mapping to "Alberta Open Data" will be replaced by a modern Dropdown `<select>`.
2. **Geo-Location IP Matching**: An Edge Function or API will fetch the user's `CF-IPCountry` or latitude/longitude natively on load.
3. **Smart Sorting**: The dropdown will feature:
   - "Worldwide" (Null filter)
   - "Current Region" (Based on IP)
   - Individual CKAN portals, ranked by geo-spatial distance from the user.
4. **Persistent State**: The client's chosen `data_source` will be stored in `localStorage` securely so the app remembers their preference automatically on boot.
