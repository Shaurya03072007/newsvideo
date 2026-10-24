import { getSettings, updateSettings } from '../../db.ts';
import type { PublicationSettings } from '../../../shared/types.ts';

export const settingsRepo = {
  get(): PublicationSettings {
    return getSettings();
  },

  update(partial: Partial<PublicationSettings>): PublicationSettings {
    return updateSettings(partial);
  },
};
