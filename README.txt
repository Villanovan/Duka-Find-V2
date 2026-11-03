DUKA FIND v8 - 2 November 2026

Prepared locally; not deployed.

website/: upload contents to the Duka GitHub Pages folder only after backend setup and staging checks. Merge all assets; do not upload supabase-setup or secrets as website files.

supabase-setup/: read SETUP.md, run 000_preflight.sql, review your actual schema/policies, then apply migrations 001 through 006 in order in staging. Configure and deploy the deletion Edge Function as described. Existing baseline ownership and participant RLS must be verified.

Chat with shop now resolves/reuses the selected customer's shop conversation on the server and opens Messages. Google sign-in resumes the selected destination. Own-shop selection opens the owner's inbox. Apply 005_shop_chat.sql and 006_realtime.sql; verify delivery with two real accounts. Local browser tests used simulated data, not live Supabase.

The category icons above names were removed. The header logo has a white circular background.

See Duka_Find_Play_Store_Integration_Guide.pdf for production Auth/SMTP, Storage, Realtime, moderation, deletion, maps, Android packaging and Play Console work. No Android app has been built and no Play submission was made.
