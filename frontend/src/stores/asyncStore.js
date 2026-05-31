import { create } from 'zustand';
import { api } from '../services/api';

export const useAsyncStore = (storeCreator) => {
  return (set, get, options) => {
    const baseStore = storeCreator(set, get, options);

    return {
      ...baseStore,
      fetchData: async (endpoint, setter) => {
        try {
          baseStore.setLoading?.(true);
          const response = await api.get(endpoint);
          setter?.(response.data);
        } catch (error) {
          baseStore.setError?.(error.message);
        } finally {
          baseStore.setLoading?.(false);
        }
      },

      createData: async (endpoint, data, setter) => {
        try {
          baseStore.setLoading?.(true);
          const response = await api.post(endpoint, data);
          setter?.(response.data);
          return response.data;
        } catch (error) {
          baseStore.setError?.(error.message);
          throw error;
        } finally {
          baseStore.setLoading?.(false);
        }
      },

      updateData: async (endpoint, data, setter) => {
        try {
          baseStore.setLoading?.(true);
          const response = await api.put(endpoint, data);
          setter?.(response.data);
          return response.data;
        } catch (error) {
          baseStore.setError?.(error.message);
          throw error;
        } finally {
          baseStore.setLoading?.(false);
        }
      },

      deleteData: async (endpoint, setter) => {
        try {
          baseStore.setLoading?.(true);
          await api.delete(endpoint);
          setter?.();
        } catch (error) {
          baseStore.setError?.(error.message);
          throw error;
        } finally {
          baseStore.setLoading?.(false);
        }
      },
    };
  };
};

export const createAsyncSlice = (config) => {
  const { name, initialState, actions, selectors = {} } = config;

  return (set, get) => ({
    ...initialState,

    ...Object.keys(actions).reduce((acc, key) => {
      acc[key] = actions[key](set, get);
      return acc;
    }, {}),

    ...Object.keys(selectors).reduce((acc, key) => {
      acc[key] = selectors[key](get);
      return acc;
    }, {}),
  });
};

export const withPersistence = (store, storageKey, whitelist = []) => {
  try {
    const savedState = localStorage.getItem(storageKey);
    if (savedState) {
      const parsed = JSON.parse(savedState);
      const partialState = whitelist.length > 0
        ? Object.fromEntries(
            whitelist.map((key) => [key, parsed[key]]).filter(([, v]) => v !== undefined)
          )
        : parsed;

      store.setState((state) => ({ ...state, ...partialState }));
    }
  } catch (e) {
    console.warn('Failed to load persisted state:', e);
  }

  store.subscribe((state) => {
    try {
      const toSave = whitelist.length > 0
        ? Object.fromEntries(
            whitelist.map((key) => [key, state[key]]).filter(([, v]) => v !== undefined)
          )
        : state;
      localStorage.setItem(storageKey, JSON.stringify(toSave));
    } catch (e) {
      console.warn('Failed to persist state:', e);
    }
  });

  return store;
};
