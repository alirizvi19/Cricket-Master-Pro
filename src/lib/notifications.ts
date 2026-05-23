// src/lib/notifications.ts
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  onSnapshot, 
  orderBy, 
  writeBatch 
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { useState, useEffect } from 'react';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  matchId?: string;
  tournamentId?: string;
  type: 'match_start' | 'match_scheduled' | 'general';
  read: boolean;
  createdAt: string;
}

/**
 * Creates notification documents in Firestore for all participants, organizer,
 * and scorers of a match when it goes live.
 */
export async function sendMatchStartNotifications(match: any, tournamentName: string) {
  try {
    const userIdsToNotify = new Set<string>();

    // 1. Fetch the tournament document to get the organizer ID and tournament scorers
    if (match.tournamentId) {
      const tournamentRef = doc(db, 'tournaments', match.tournamentId);
      const tournamentSnap = await getDoc(tournamentRef);
      if (tournamentSnap.exists()) {
        const tournamentData = tournamentSnap.data();
        
        // Notify organizer
        if (tournamentData.organizerId) {
          userIdsToNotify.add(tournamentData.organizerId);
        }
        
        // Notify scorers
        if (Array.isArray(tournamentData.scorers)) {
          tournamentData.scorers.forEach((scorerId: string) => {
            if (scorerId) userIdsToNotify.add(scorerId);
          });
        }
      }
    }

    // 2. Fetch players registered for Team A and Team B to notify them
    // Users associated with players in Team A
    if (match.teamAId) {
      const teamAPlayersQuery = query(
        collection(db, 'players'), 
        where('teamId', '==', match.teamAId)
      );
      const teamAPlayersSnap = await getDocs(teamAPlayersQuery);
      teamAPlayersSnap.docs.forEach((d) => {
        const pData = d.data();
        if (pData.userId) {
          userIdsToNotify.add(pData.userId);
        }
      });
    }

    // Users associated with players in Team B
    if (match.teamBId) {
      const teamBPlayersQuery = query(
        collection(db, 'players'), 
        where('teamId', '==', match.teamBId)
      );
      const teamBPlayersSnap = await getDocs(teamBPlayersQuery);
      teamBPlayersSnap.docs.forEach((d) => {
        const pData = d.data();
        if (pData.userId) {
          userIdsToNotify.add(pData.userId);
        }
      });
    }

    // 3. Write notifications for all identified user IDs in Firestore
    const promises = Array.from(userIdsToNotify).map((userId) => {
      return addDoc(collection(db, 'notifications'), {
        userId,
        title: 'Match is Live! 🏏',
        message: `${match.teamAName || 'Team A'} vs ${match.teamBName || 'Team B'} is starting now in "${tournamentName}"!`,
        matchId: match.id || '',
        tournamentId: match.tournamentId || '',
        type: 'match_start',
        read: false,
        createdAt: new Date().toISOString(),
      });
    });

    await Promise.all(promises);
    console.log(`Successfully sent match start notifications to ${userIdsToNotify.size} users.`);
  } catch (err) {
    console.error('Error sending match start notifications:', err);
  }
}

/**
 * Custom React Hook to listen and interact with a user's notifications in real-time.
 */
export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    // Guard: Only subscribe if the Firebase client is authenticated as the requested user.
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Notification[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        } as Notification));
        
        // Client-side sort: newest first
        list.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });

        setNotifications(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to notifications:', err);
        setLoading(false);
        try {
          handleFirestoreError(err, OperationType.GET, 'notifications');
        } catch (e) {
          // Log and catch the formatted error
        }
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, { read: true });
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter((n) => !n.read);
      if (unreadNotifications.length === 0) return;

      const batch = writeBatch(db);
      unreadNotifications.forEach((n) => {
        const ref = doc(db, 'notifications', n.id);
        batch.update(ref, { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await deleteDoc(notificationRef);
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const clearAll = async () => {
    try {
      if (notifications.length === 0) return;
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        const ref = doc(db, 'notifications', n.id);
        batch.delete(ref);
      });
      await batch.commit();
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  };
}
