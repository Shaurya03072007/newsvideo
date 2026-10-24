import {
  getUsers,
  getUserById,
  getUserByEmail,
  getUserByGoogleId,
  upsertGoogleUser,
  updateUserProfile,
  hasEditor,
  getReporters,
  addReporter,
  removeReporter,
} from '../../db.ts';
import type { User, UserProfileUpdate } from '../../../shared/types.ts';

export const usersRepo = {
  list(): User[] {
    return getUsers();
  },

  getById(id: string): User | null {
    return getUserById(id) || getUsers().find((u) => u.id === id) || null;
  },

  findByUsername(username: string): User | null {
    return getUsers().find((u) => u.username === username) || null;
  },

  findByEmail(email: string): User | null {
    return getUserByEmail(email);
  },

  findByGoogleId(googleId: string): User | null {
    return getUserByGoogleId(googleId);
  },

  hasEditor(): boolean {
    return hasEditor();
  },

  getReporters(): User[] {
    return getReporters();
  },

  addReporter(payload: {
    name: string;
    email: string;
    displayNameTelugu?: string;
    district?: string;
    bureau?: string;
  }): User {
    return addReporter(payload);
  },

  removeReporter(userId: string): boolean {
    return removeReporter(userId);
  },

  upsertGoogle(payload: {
    sub?: string;
    email: string;
    name: string;
    picture?: string;
    displayNameTelugu?: string;
    role?: User['role'];
    district?: string;
    bureau?: string;
  }): User {
    return upsertGoogleUser(payload);
  },

  updateProfile(userId: string, updates: UserProfileUpdate): User | null {
    return updateUserProfile(userId, updates);
  },
};

