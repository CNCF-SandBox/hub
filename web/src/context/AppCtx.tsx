import isUndefined from 'lodash/isUndefined';
import React, { createContext, useContext, useEffect, useReducer } from 'react';

import { API } from '../api';
import useSystemThemeMode from '../hooks/useSystemThemeMode';
import { Prefs, Profile, ThemePrefs, UserFullName } from '../types';
import detectActiveThemeMode from '../utils/detectActiveThemeMode';
import history from '../utils/history';
import isControlPanelSectionAvailable from '../utils/isControlPanelSectionAvailable';
import lsStorage from '../utils/localStoragePreferences';

interface AppState {
  user: Profile | null | undefined;
  prefs: Prefs;
}

interface Props {
  children: JSX.Element;
}

const initialState: AppState = {
  user: undefined,
  prefs: lsStorage.getPrefs(),
};

type Action =
  | { type: 'signIn'; profile: Profile }
  | { type: 'signOut' }
  | { type: 'unselectOrg' }
  | { type: 'updateUser'; user: UserFullName }
  | { type: 'updateOrg'; name: string }
  | { type: 'updateLimit'; limit: number }
  | { type: 'updateTheme'; theme: string }
  | { type: 'updateEfectiveTheme'; theme: string }
  | { type: 'enableAutomaticTheme'; enabled: boolean }
  | { type: 'enabledDisplayedNotifications'; enabled: boolean }
  | { type: 'addNewDisplayedNotification'; id: string };

export const AppCtx = createContext<{
  ctx: AppState;
  dispatch: React.Dispatch<any>;
}>({
  ctx: initialState,
  dispatch: () => null,
});

export function signOut() {
  return { type: 'signOut' };
}

export function unselectOrg() {
  return { type: 'unselectOrg' };
}

export function updateOrg(name: string) {
  return { type: 'updateOrg', name };
}

export function updateUser(user: UserFullName) {
  return { type: 'updateUser', user };
}

export function updateLimit(limit: number) {
  return { type: 'updateLimit', limit };
}

export function updateTheme(theme: string) {
  return { type: 'updateTheme', theme };
}

export function updateEfectiveTheme(theme: string) {
  return { type: 'updateTheme', theme };
}

export function enableAutomaticTheme(enabled: boolean) {
  return { type: 'enableAutomaticTheme', enabled };
}

export function enabledDisplayedNotifications(enabled: boolean) {
  return { type: 'enabledDisplayedNotifications', enabled };
}

export function addNewDisplayedNotification(id: string) {
  return { type: 'addNewDisplayedNotification', id };
}

export async function refreshUserProfile(dispatch: React.Dispatch<any>, redirectUrl?: string) {
  try {
    const profile: Profile = await API.getUserProfile();
    dispatch({ type: 'signIn', profile });
    if (!isUndefined(redirectUrl)) {
      // Redirect to correct route when neccessary
      history.push({ pathname: redirectUrl });
    }
  } catch {
    dispatch({ type: 'signOut' });
  }
}

function redirectToControlPanel(context: 'user' | 'org') {
  if (history.location.pathname.startsWith('/control-panel')) {
    const sections = history.location.pathname.split('/');
    if (!isControlPanelSectionAvailable(context, sections[2], sections[3])) {
      history.push('/control-panel/repositories');
    }
  }
}

function updateSelectedOrg(currentPrefs: Prefs, name?: string): Prefs {
  return {
    ...currentPrefs,
    controlPanel: {
      ...currentPrefs.controlPanel,
      selectedOrg: name,
    },
  };
}

function updateAutomaticTheme(currentPrefs: Prefs, enabled: boolean): Prefs {
  return {
    ...currentPrefs,
    theme: {
      ...currentPrefs.theme,
      automatic: enabled,
      efective: enabled ? detectActiveThemeMode() : currentPrefs.theme.configured,
    },
  };
}

export function updateActiveStyleSheet(current: string) {
  document.getElementsByTagName('html')[0].setAttribute('data-theme', current);
}

function getCurrentSystemActiveTheme(prefs: ThemePrefs): ThemePrefs {
  if (prefs.automatic && (isUndefined(prefs.efective) || detectActiveThemeMode() !== prefs.efective)) {
    return {
      ...prefs,
      efective: detectActiveThemeMode(),
    };
  } else {
    return prefs;
  }
}

export function appReducer(state: AppState, action: Action) {
  let prefs;
  switch (action.type) {
    case 'signIn':
      prefs = lsStorage.getPrefs(action.profile.alias);
      const userPrefs = { ...prefs, theme: getCurrentSystemActiveTheme(prefs.theme) };
      updateActiveStyleSheet(userPrefs.theme.efective || userPrefs.theme.configured);
      lsStorage.setPrefs(userPrefs, action.profile.alias);
      lsStorage.setActiveProfile(action.profile.alias);
      return {
        user: action.profile,
        prefs: userPrefs,
      };

    case 'unselectOrg':
      prefs = updateSelectedOrg(state.prefs);
      lsStorage.setPrefs(prefs, state.user!.alias);
      redirectToControlPanel('user');
      return {
        ...state,
        prefs: prefs,
      };

    case 'signOut':
      prefs = lsStorage.getPrefs();
      const guestPrefs = { ...prefs, theme: getCurrentSystemActiveTheme(prefs.theme) };
      lsStorage.setPrefs(guestPrefs);
      lsStorage.setActiveProfile();
      updateActiveStyleSheet(guestPrefs.theme.efective || guestPrefs.theme.configured);
      return { user: null, prefs: guestPrefs };

    case 'updateOrg':
      prefs = updateSelectedOrg(state.prefs, action.name);
      lsStorage.setPrefs(prefs, state.user!.alias);
      if (isUndefined(state.prefs.controlPanel.selectedOrg) || action.name !== state.prefs.controlPanel.selectedOrg) {
        redirectToControlPanel('org');
      }
      return {
        ...state,
        prefs: prefs,
      };

    case 'updateLimit':
      prefs = {
        ...state.prefs,
        search: {
          ...state.prefs.search,
          limit: action.limit,
        },
      };
      lsStorage.setPrefs(prefs, state.user ? state.user.alias : undefined);
      return {
        ...state,
        prefs: prefs,
      };

    case 'updateTheme':
      prefs = {
        ...state.prefs,
        theme: {
          configured: action.theme,
          efective: action.theme,
          automatic: false,
        },
      };
      lsStorage.setPrefs(prefs, state.user ? state.user.alias : undefined);
      updateActiveStyleSheet(action.theme);
      return {
        ...state,
        prefs: prefs,
      };

    case 'updateEfectiveTheme':
      prefs = {
        ...state.prefs,
        theme: {
          ...state.prefs.theme,
          efective: action.theme,
        },
      };
      lsStorage.setPrefs(prefs, state.user ? state.user.alias : undefined);
      updateActiveStyleSheet(action.theme);
      return {
        ...state,
        prefs: prefs,
      };

    case 'enableAutomaticTheme':
      prefs = updateAutomaticTheme(state.prefs, action.enabled);
      lsStorage.setPrefs(prefs, state.user ? state.user.alias : undefined);
      updateActiveStyleSheet(prefs.theme.efective || prefs.theme.configured);
      return {
        ...state,
        prefs: prefs,
      };

    case 'updateUser':
      lsStorage.updateAlias(state.user!.alias, action.user.alias);
      lsStorage.setActiveProfile(action.user.alias);
      return {
        ...state,
        user: {
          ...state.user!,
          ...action.user,
        },
      };

    case 'enabledDisplayedNotifications':
      prefs = {
        ...state.prefs,
        notifications: {
          ...state.prefs.notifications,
          enabled: action.enabled,
        },
      };
      lsStorage.setPrefs(prefs, state.user ? state.user.alias : undefined);
      return {
        ...state,
        prefs: prefs,
      };

    case 'addNewDisplayedNotification':
      prefs = {
        ...state.prefs,
        notifications: {
          ...state.prefs.notifications,
          displayed: [...state.prefs.notifications.displayed, action.id],
          lastDisplayedTime: Date.now(),
        },
      };
      lsStorage.setPrefs(prefs, state.user ? state.user.alias : undefined);
      return {
        ...state,
        prefs: prefs,
      };

    default:
      return { ...state };
  }
}

function AppCtxProvider(props: Props) {
  const [ctx, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    refreshUserProfile(dispatch);
  }, []);

  useSystemThemeMode(ctx.prefs.theme.automatic, dispatch);

  return <AppCtx.Provider value={{ ctx, dispatch }}>{props.children}</AppCtx.Provider>;
}

function useAppCtx() {
  return useContext(AppCtx);
}

export { AppCtxProvider, useAppCtx };
