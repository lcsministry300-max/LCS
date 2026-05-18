/* ============================================================
   Lucban Christian School — Firebase Initializer
   firebase-init.js

   This file runs AFTER firebase-app-compat.js and
   firebase-firestore-compat.js because all three are loaded
   with `defer` in order. Safe — no timing issues.
   ============================================================ */

const firebaseConfig = {
  apiKey:            "AIzaSyBZ9LeFx7QGZDYNJq7gfDnYtWQ3S7DxuQk",
  authDomain:        "lcs-website-52bdf.firebaseapp.com",
  projectId:         "lcs-website-52bdf",
  storageBucket:     "lcs-website-52bdf.firebasestorage.app",
  messagingSenderId: "440967467072",
  appId:             "1:440967467072:web:1290825ccb826c1c634fa5"
};

firebase.initializeApp(firebaseConfig);

// `db` is a global so main.js can use it directly
var db = firebase.firestore();
