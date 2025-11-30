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

const parseUser = (raw: string | null) => {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
};

export const storeAuthState = (
  userType: SupportedUserType,
  token: string | null,
  user: any
) => {
  const keys = STORAGE_KEYS[userType];
  if (!keys) {
    return;
  }

  // ✅ CRITICAL: Check if we're trying to overwrite a different user's data
  const existingUser = parseUser(localStorage.getItem(keys.user));
  if (existingUser && user && existingUser.id && user.id && existingUser.id !== user.id) {
    console.error('[AUTH STORAGE] 🚨 PREVENTING DATA OVERWRITE!', {
      userType,
      existingUserId: existingUser.id,
      existingUsername: existingUser.username,
      newUserId: user.id,
      newUsername: user.username,
      action: 'REJECTING storeAuthState call to prevent data corruption'
    });
    // Don't overwrite - keep existing user data
    return;
  }

  const userPayload = user ? { ...user, userType: userType } : null;

  if (token) {
    localStorage.setItem(keys.token, token);
  }

  if (userPayload) {
    localStorage.setItem(keys.user, JSON.stringify(userPayload));
    console.log('[AUTH STORAGE] ✅ Stored user data:', {
      userType,
      userId: userPayload.id,
      username: userPayload.username,
    });
  }

  sessionStorage.setItem(ACTIVE_USER_SESSION_KEY, userType);
};

export const markActiveUserType = (userType: SupportedUserType) => {
  sessionStorage.setItem(ACTIVE_USER_SESSION_KEY, userType);
};

export const getAuthStateForType = (userType: SupportedUserType) => {
  const keys = STORAGE_KEYS[userType];
  const user = parseUser(localStorage.getItem(keys.user));
  const token = localStorage.getItem(keys.token);

  return {
    user,
    token,
    userType: user ? userType : null
  };
};

export const getActiveAuthState = () => {
  const sessionType = sessionStorage.getItem(ACTIVE_USER_SESSION_KEY) as SupportedUserType | null;

  if (sessionType && STORAGE_KEYS[sessionType]) {
    const state = getAuthStateForType(sessionType);
    if (state.user) {
      return state;
    }
  }

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
