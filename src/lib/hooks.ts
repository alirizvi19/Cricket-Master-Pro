import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;
    
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        unsubscribeUser = onSnapshot(
          doc(db, 'users', user.uid),
          (userDoc) => {
            if (userDoc.exists()) {
              setIsAdmin(userDoc.data().role === 'admin');
            }
          },
          (error) => {
            if (error.code !== 'unavailable' && !error.message.includes('offline')) {
              console.error('Error fetching user role:', error);
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

  return { user, loading, isAdmin };
}
