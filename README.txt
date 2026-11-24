POULTRY MEDICINE MANAGER — FIREBASE + GITHUB EDITION

This project keeps the existing Firebase project and Firestore data paths.
Firebase project: poultry-medicine-manager-93b79

WHAT THIS BUILD INCLUDES
- Firebase Email/Password and Google authentication
- Existing inventory, batches, expiry, sales/POS, purchases, ledger,
  customers, suppliers, expenses, deliveries, returns and reports
- Multi-item POS cart and branch-aware records
- Staff roles and accounting screens
- AI Business Copilot has been removed from the interface and app logic
- Refined responsive design with subtle transitions and motion effects

IMPORTANT DATA SAFETY
- Do not delete the Firebase project or Firestore database.
- Do not rename existing Firestore collections or user document paths.
- Keep a backup before changing Firestore security rules.
- Test changes with a test account before using important live records.

SIMPLE PROJECT MANAGEMENT
1. GITHUB
   - Create/open your private GitHub repository.
   - Upload the project files and commit changes.
   - Keep GitHub as the source-code backup and version history.

2. FIREBASE
   - Open https://console.firebase.google.com/project/poultry-medicine-manager-93b79
   - Authentication: manage Email/Password and Google sign-in providers.
   - Firestore Database: manage and review business records.
   - Hosting: connect the GitHub repository using Firebase Hosting's
     GitHub integration to configure preview and live deployments.

3. FRONTEND CONFIG
   - Firebase Web App configuration is already present in app.js.
   - Do not replace it with a new Firebase project configuration.

CLOUD FUNCTIONS NOTE
The functions/ folder is retained because the optional staff invitation,
role update, staff removal and legacy branch-tagging actions depend on it.
Those particular actions require Cloud Functions deployment. The normal
frontend and Firebase Authentication/Firestore workflow remains separate.
Do not delete functions/ if you intend to use those staff administration
and branch initialization actions. If you want a strictly no-Functions
edition, those dependent actions need a separate redesign.

MOTION / ACCESSIBILITY
Animations are intentionally subtle. The app respects the operating system's
reduced-motion accessibility preference.

This package has been syntax-checked. A live Firebase deployment and full
browser end-to-end test have not been performed as part of this update.


NEON BLUE EDITION
This edition uses a unified dark navy + electric neon blue visual theme, animated gradient primary buttons, light-sweep hover effects, glowing navigation, animated dashboard cards/panels, and reduced-motion accessibility. Firebase project configuration and Firestore paths remain unchanged.
