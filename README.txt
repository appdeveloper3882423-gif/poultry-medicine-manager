POULTRY MEDICINE MANAGER
========================

PROJECT FILES
-------------
1. index.html       Main application interface
2. style.css        Responsive styling
3. app.js           Application logic and Firebase connection
4. firestore.rules  Firestore access rules
5. README.txt       Setup and deployment instructions

IMPORTANT
---------
This package consolidates the supplied Poultry Medicine Manager project into
five files. It preserves the existing app data model and Firebase project.
It is not a newly generated enterprise backend. Features that require a
separate server/API (for example the AI Copilot API endpoint) need that server
component deployed separately.

FIREBASE PROJECT
----------------
Project ID: poultry-medicine-manager-93b79
The existing Firebase Web App configuration is already present in app.js.
The Firebase web API key is a public client identifier; database access must
be protected by Firestore Security Rules and Firebase Authentication.

FIREBASE SETUP
--------------
1. Open https://console.firebase.google.com/ and select:
   poultry-medicine-manager-93b79
2. In Authentication > Sign-in method, enable:
   - Email/Password
   - Google
3. In Firestore Database, create or open the database.
4. Open Firestore Database > Rules.
5. Copy the complete contents of firestore.rules into the Rules editor.
6. Click Publish.
7. In Project settings > General, confirm that the Web App configuration in
   app.js matches this Firebase project.

RUN LOCALLY
-----------
1. Extract the ZIP.
2. Open the extracted folder in VS Code.
3. Use a local development server (for example VS Code Live Server).
   Do not open index.html directly as a file:// page because app.js uses ES
   module imports from Google's Firebase CDN.
4. Visit the local server URL and create an account or sign in.

DEPLOY TO VERCEL
----------------
1. Upload the five files to the root of a GitHub repository.
2. Import that repository into Vercel.
3. Framework preset: Other.
4. Build command: leave empty.
5. Output directory: leave as the project root (or use the default static
   output setting offered by Vercel).
6. Deploy.

DATA AND SECURITY NOTES
-----------------------
- Existing app records are stored under users/{your-auth-uid}.
- Product records use the inventory subcollection; other records use their
  named subcollections (sales, purchases, customers, suppliers, expenses,
  deliveries, returns and ledger).
- The included rules isolate each user's workspace from other user accounts.
- These rules are owner-account rules. They do not implement secure staff
  membership, custom role permissions, branch-level access, or Admin SDK
  account creation. Those require trusted server-side Cloud Functions or
  another backend and corresponding security rules.
- Never store staff passwords in Firestore or expose Firebase Admin SDK
  credentials in browser code.
- Keep regular backups of important business data.

AI COPILOT NOTE
---------------
The current app calls /api/ai for AI Copilot responses. This ZIP intentionally
contains the requested five files only and does not include that server API.
The Copilot requires a separately deployed server endpoint and secure server
credentials (such as Vercel environment variables). Do not put an AI secret
key in app.js.

TROUBLESHOOTING
---------------
- If sign-in fails, confirm Email/Password or Google provider is enabled.
- If data reads/writes fail, confirm firestore.rules has been published.
- If Google sign-in is blocked, add your deployed domain under Firebase
  Authentication > Settings > Authorized domains.
- If the browser shows a module/CORS error, serve the folder over HTTP using
  a local development server instead of opening the HTML file directly.
- If the app was previously deployed, use the same Firebase project and
  existing account so the app can read that account's existing records.
