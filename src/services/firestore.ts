import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  deleteDoc,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { User, UserPreferences, Progress, WeeklyPlanItem } from '../types';

// User Profile Operations
export const createUserProfile = async (uid: string, userData: Partial<User>) => {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    ...userData,
    createdAt: Timestamp.now(),
    lastLoginAt: Timestamp.now()
  });
};

export const getUserProfile = async (uid: string): Promise<User | null> => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    const data = userSnap.data();
    return {
      ...data,
      id: uid,
      createdAt: data.createdAt?.toDate() || new Date(),
      lastLoginAt: data.lastLoginAt?.toDate() || new Date()
    } as User;
  }
  return null;
};

export const updateUserProfile = async (uid: string, updates: Partial<User>) => {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    ...updates,
    lastLoginAt: Timestamp.now()
  }, { merge: true });
};

// User Preferences Operations
export const getUserPreferences = async (uid: string): Promise<UserPreferences | null> => {
  const preferencesRef = doc(db, 'users', uid, 'preferences', 'settings');
  const preferencesSnap = await getDoc(preferencesRef);
  
  if (preferencesSnap.exists()) {
    return preferencesSnap.data() as UserPreferences;
  }
  return null;
};

export const updateUserPreferences = async (uid: string, preferences: UserPreferences) => {
  const preferencesRef = doc(db, 'users', uid, 'preferences', 'settings');
  await setDoc(preferencesRef, preferences, { merge: true });
};

// Progress Operations
export const addProgress = async (uid: string, progressData: Omit<Progress, 'completedAt'>) => {
  const progressRef = collection(db, 'users', uid, 'progress');
  await addDoc(progressRef, {
    ...progressData,
    completedAt: Timestamp.now()
  });
};

export const getUserProgress = async (uid: string): Promise<Progress[]> => {
  const progressRef = collection(db, 'users', uid, 'progress');
  const q = query(progressRef, orderBy('completedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    ...doc.data(),
    completedAt: doc.data().completedAt?.toDate() || new Date()
  })) as Progress[];
};

export const subscribeToProgress = (uid: string, callback: (progress: Progress[]) => void) => {
  const progressRef = collection(db, 'users', uid, 'progress');
  const q = query(progressRef, orderBy('completedAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const progress = snapshot.docs.map(doc => ({
      ...doc.data(),
      completedAt: doc.data().completedAt?.toDate() || new Date()
    })) as Progress[];
    callback(progress);
  });
};

// Weekly Plan Operations
export const getWeeklyPlan = async (uid: string): Promise<WeeklyPlanItem[]> => {
  const weeklyPlanRef = collection(db, 'users', uid, 'weekly_plan');
  const querySnapshot = await getDocs(weeklyPlanRef);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as WeeklyPlanItem[];
};

export const addWeeklyPlanItem = async (uid: string, planItem: Omit<WeeklyPlanItem, 'id'>) => {
  const weeklyPlanRef = collection(db, 'users', uid, 'weekly_plan');
  const docRef = await addDoc(weeklyPlanRef, planItem);
  return docRef.id;
};

export const updateWeeklyPlanItem = async (uid: string, itemId: string, updates: Partial<WeeklyPlanItem>) => {
  const itemRef = doc(db, 'users', uid, 'weekly_plan', itemId);
  await updateDoc(itemRef, updates);
};

export const deleteWeeklyPlanItem = async (uid: string, itemId: string) => {
  const itemRef = doc(db, 'users', uid, 'weekly_plan', itemId);
  await deleteDoc(itemRef);
};

export const subscribeToWeeklyPlan = (uid: string, callback: (plan: WeeklyPlanItem[]) => void) => {
  const weeklyPlanRef = collection(db, 'users', uid, 'weekly_plan');
  
  return onSnapshot(weeklyPlanRef, (snapshot) => {
    const plan = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as WeeklyPlanItem[];
    callback(plan);
  });
};

// Analytics and Insights
export const getWeeklyStats = async (uid: string) => {
  const progressRef = collection(db, 'users', uid, 'progress');
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const q = query(
    progressRef, 
    where('completedAt', '>=', Timestamp.fromDate(weekAgo)),
    orderBy('completedAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  const weeklyProgress = querySnapshot.docs.map(doc => ({
    ...doc.data(),
    completedAt: doc.data().completedAt?.toDate() || new Date()
  })) as Progress[];
  
  return {
    topicsCompleted: weeklyProgress.length,
    totalTimeSpent: weeklyProgress.reduce((acc, item) => acc + item.timeSpent, 0),
    averageScore: weeklyProgress.length > 0 
      ? weeklyProgress.reduce((acc, item) => acc + item.score, 0) / weeklyProgress.length 
      : 0,
    streakDays: calculateStreakDays(weeklyProgress)
  };
};

const calculateStreakDays = (progress: Progress[]): number => {
  if (progress.length === 0) return 0;
  
  const dates = progress.map(p => p.completedAt.toDateString());
  const uniqueDates = [...new Set(dates)].sort();
  
  let streak = 0;
  const today = new Date().toDateString();
  let currentDate = new Date();
  
  for (let i = 0; i < 30; i++) { // Check last 30 days
    const dateStr = currentDate.toDateString();
    if (uniqueDates.includes(dateStr)) {
      streak++;
    } else if (dateStr !== today) {
      break;
    }
    currentDate.setDate(currentDate.getDate() - 1);
  }
  
  return streak;
};