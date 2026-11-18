
POULTRY MEDICINE MANAGER
=======================

PROJECT FILES
-------------
1. README.txt
2. index.html
3. style.css
4. app.js
5. firestore.rules


REQUIREMENTS
------------
- Google account
- Firebase project
- GitHub account
- Vercel account
- Internet connection


STEP 1: FIREBASE CONFIGURATION
------------------------------
1. Open https://console.firebase.google.com/
2. Select your existing project:
   poultry-medicine-manager-93b79
3. Open Project Settings.
4. Find Your Apps.
5. Select your existing Web App.
6. Copy its Firebase configuration.
7. Open app.js.
8. Find FIREBASE_CONFIG.
9. Replace its values with the exact configuration
   copied from Firebase Console.

IMPORTANT:
Do not create a new Firebase project.
Use your existing project and database.


STEP 2: ENABLE AUTHENTICATION
-----------------------------
1. Open Firebase Authentication.
2. Select Sign-in method.
3. Enable Email/Password.
4. Enable Google.
5. Save changes.


STEP 3: FIRESTORE DATABASE
--------------------------
1. Open Firestore Database.
2. Make sure your existing database is available.
3. Open the Rules tab.
4. Back up your existing rules.
5. Review and publish the supplied firestore.rules.

IMPORTANT:
The supplied rules allow each signed-in user
to access their own /users/{uid}/ records.
They do not implement staff or branch permissions.


STEP 4: PROJECT FILES
---------------------
Keep all five files in the same project folder:

PoultryMedicineManager/
|
|-- index.html
|-- style.css
|-- app.js
|-- firestore.rules
|-- README.txt


STEP 5: TEST LOCALLY
--------------------
1. Open the project folder in VS Code.
2. Install the Live Server extension.
3. Right-click index.html.
4. Select Open with Live Server.
5. Test registration and login.
6. Test inventory and sales.
7. Check browser console for errors.


STEP 6: GITHUB UPLOAD
---------------------
1. Open https://github.com/
2. Create or open your repository.
3. Upload the project files.
4. Commit the changes.


STEP 7: VERCEL DEPLOYMENT
-------------------------
1. Open https://vercel.com/
2. Import your GitHub repository.
3. Select the project.
4. Keep the framework preset as Other.
5. Deploy.
6. Open the generated website URL.
7. Test the application on mobile and desktop.


DATA SAFETY
-----------
- Keep your existing Firebase project.
- Do not delete existing Firestore collections.
- Do not change existing document IDs.
- Back up your database before changing rules.
- Never share private passwords or service-account keys.
- Firebase web configuration is not a service-account key.


IMPORTANT PROJECT LIMITATIONS
-----------------------------
This version should be tested before being used for
real business records.

The delivered code does not yet implement the full
advanced ERP scope, including:

- Batch-wise FEFO stock management
- Complete double-entry accounting
- Multi-branch permissions
- Staff role-based access
- Advanced approval workflows
- Full audit and stock movement history

Do not treat these features as completed until they
are separately developed and tested.


END OF README
