import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, updateDoc, doc, getDocs, collection } from 'firebase/firestore';
import * as fs from 'fs';

const fbConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(fbConfig.config);
const auth = getAuth(app);
const db = getFirestore(app);

async function test() {
  try {
    await signInWithEmailAndPassword(auth, 'ali.ammar.rizvi13@gmail.com', 'password123'); // Assuming some password or we can just bypass auth
    console.log("Logged in");
  } catch (e) {
    console.log("Auth failed, maybe no password?", e.message);
  }
}

test();
