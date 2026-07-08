import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAcMh_nI3-JfPCaZsZj-NaIFpbNmj6UvhA",
  authDomain: "thunderstorm-d57a5.firebaseapp.com",
  projectId: "thunderstorm-d57a5",
  storageBucket: "thunderstorm-d57a5.firebasestorage.app",
  messagingSenderId: "372015869533",
  appId: "1:372015869533:web:176af1d09f0d2e5de567b4",
  measurementId: "G-YJTJ8YTYMG"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
