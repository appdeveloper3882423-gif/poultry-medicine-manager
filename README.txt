POULTRY MEDICINE MANAGER — UPGRADED FILES

Included:
- index.html — Poultry Medicine Manager branding and interface
- style.css — responsive mobile/tablet/laptop/desktop layout
- app.js — medicine inventory, type dropdown, supplier/customer contacts, sales, stock movement, expiry alerts, ledger, reports, Firebase authentication and sync
- firestore.rules — per-user Firestore access rules

IMPORTANT FIREBASE SETUP
1. Open Firebase Console and select project: poultry-medicine-manager-93b79.
2. Project settings (gear) > General > Your apps. Select/register a Web app and copy its Firebase SDK config.
3. Open app.js and replace the four placeholder values below with the exact values from that Web App config:
   apiKey: PASTE_YOUR_FIREBASE_WEB_API_KEY
   messagingSenderId: PASTE_YOUR_MESSAGING_SENDER_ID
   appId: PASTE_YOUR_FIREBASE_WEB_APP_ID
   Also confirm authDomain and storageBucket match your project's displayed config exactly.
   Do NOT use a Google Cloud API key from another project.
4. In Authentication > Sign-in method, enable Email/Password and Google. Add your deployed domain to Authorized domains for Google sign-in.
5. Create Firestore Database if not already created. Open Rules, paste firestore.rules, and Publish.
6. Deploy the three app files and firestore.rules to your hosting project.

FEATURES
- Poultry medicine name and medicine type dropdown
- Supplier contact number; customer name/contact saved with sales history
- Stock quantities update on recorded sales and purchases
- Batch and expiry date tracking, low-stock/expiry alerts
- Sales, purchases, deliveries, customer/supplier records, ledger and CSV exports
- Responsive interface and dark navy/blue trading-style charts
- Email/password + Google auth and persistent login

SAFETY
The Firebase API key/appId/senderId placeholders intentionally remain unfilled because the exact Web App config must be copied from your own Firebase project. The app will not authenticate until you replace them. Test with sample records before relying on it for real financial or medicine stock records. The ledger and profit figures depend on complete, correct entries.
