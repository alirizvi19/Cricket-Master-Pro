import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>('viewer');

  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;
    
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        if (user.email === 'ali.ammar.rizvi13@gmail.com') {
          setIsAdmin(true);
          setUserRole('admin');
        }
        unsubscribeUser = onSnapshot(
          doc(db, 'users', user.uid),
          (userDoc) => {
            if (userDoc.exists()) {
              const data = userDoc.data();
              setDbUser(data);
              setIsAdmin(data.role === 'admin' || user.email === 'ali.ammar.rizvi13@gmail.com');
              setUserRole(user.email === 'ali.ammar.rizvi13@gmail.com' ? 'admin' : (data.role || 'viewer'));
            } else {
              setDbUser(null);
            }
          },
          (error) => {
            if (error.code !== 'unavailable' && !error.message.includes('offline')) {
              console.error('Error fetching user role:\n' + error.message + '\nIf you just created this Firebase project, make sure you have initialized the Firestore Database in the Firebase Console.');
            }
          }
        );
      } else {
        if (unsubscribeUser) {
          unsubscribeUser();
          unsubscribeUser = null;
        }
        setIsAdmin(false);
      }
      setLoading(false);
    });
    
    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) {
        unsubscribeUser();
      }
    };
  }, []);

  return { user, dbUser, loading, isAdmin, userRole };
}
