const ACTIVE_USER_SESSION_KEY = 'activeUserType';

const STORAGE_KEYS = {
  student: {
    user: 'studentUser',
    token: 'studentToken'
  },
  tutor: {
    user: 'tutorUser',
    token: 'tutorToken'
  }
} as const;

export type SupportedUserType = keyof typeof STORAGE_KEYS;

export interface StoredUser {
  id?: number | string;
  username?: string;
  name?: string;
  email?: string;
  userType?: SupportedUserType | string;
  role?: string;
  bio?: string;
  education?: string;
  specialties?: string[];
  rate?: number;
  ratePer10Min?: number;
  rate_per_10_min?: number;
  averageRating?: number;
  ratingsCount?: number;
  [key: string]: unknown;
}

const parseUser = (raw: string | null): StoredUser | null => {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
};

export interface AuthState {
  user: StoredUser | null;
  token: string | null;
  userType: SupportedUserType | null;
}

export type MeResponse = {
  user?: StoredUser | null;
};

export const storeAuthState = (
  userType: SupportedUserType,
  token: string | null,
  user: StoredUser | null
) => {
  const keys = STORAGE_KEYS[userType];
  if (!keys) {
    return;
  }

  const userPayload = user ? { ...user, userType: userType } : null;

  if (token) {
    localStorage.setItem(keys.token, token);
  }

  if (userPayload) {
    const payloadStr = JSON.stringify(userPayload);
    // Persist to localStorage (shared across tabs)
    localStorage.setItem(keys.user, payloadStr);
    // Also persist to sessionStorage (isolated per tab)
    sessionStorage.setItem(keys.user, payloadStr);
  }

  sessionStorage.setItem(ACTIVE_USER_SESSION_KEY, userType);
};

export const markActiveUserType = (userType: SupportedUserType) => {
  sessionStorage.setItem(ACTIVE_USER_SESSION_KEY, userType);
};

export const getAuthStateForType = (userType: SupportedUserType): AuthState => {
  const keys = STORAGE_KEYS[userType];
  
  // Prefer sessionStorage (tab-isolated) over localStorage (shared)
  let rawUser = sessionStorage.getItem(keys.user);
  if (!rawUser) {
    rawUser = localStorage.getItem(keys.user);
  }
  
  const user = parseUser(rawUser);
  const token = localStorage.getItem(keys.token);

  return {
    user,
    token,
    userType: user ? userType : null
  };
};

export const getActiveAuthState = (): AuthState => {
  const sessionType = sessionStorage.getItem(ACTIVE_USER_SESSION_KEY) as SupportedUserType | null;

  // Strict check: if session says we are X, only return X.
  // Do not fallback to other types to avoid cross-tab contamination.
  if (sessionType && STORAGE_KEYS[sessionType]) {
    return getAuthStateForType(sessionType);
  }

  // Only fallback if NO session type is set (e.g. fresh tab/window)
  const studentState = getAuthStateForType('student');
  if (studentState.user) {
    return studentState;
  }

  const tutorState = getAuthStateForType('tutor');
  if (tutorState.user) {
    return tutorState;
  }

  return {
    user: null,
    token: null,
    userType: null
  };
};

export const clearAuthState = (userType: SupportedUserType) => {
  const keys = STORAGE_KEYS[userType];
  localStorage.removeItem(keys.user);
  localStorage.removeItem(keys.token);

  const activeType = sessionStorage.getItem(ACTIVE_USER_SESSION_KEY);
  if (activeType === userType) {
    sessionStorage.removeItem(ACTIVE_USER_SESSION_KEY);
  }
};

export const clearAllAuthStates = () => {
  (Object.keys(STORAGE_KEYS) as SupportedUserType[]).forEach((type) => {
    const keys = STORAGE_KEYS[type];
    localStorage.removeItem(keys.user);
    localStorage.removeItem(keys.token);
  });

  sessionStorage.removeItem(ACTIVE_USER_SESSION_KEY);
};
