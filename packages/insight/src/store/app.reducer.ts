import {createSlice, PayloadAction} from '@reduxjs/toolkit';

/**
 * Define types for the state
 */
interface AppState {
  loading: boolean;
  theme: string;
  currency?: string;
  network?: string;
}

/**
 * Define Initial state
 */
const initialTheme = window.localStorage.getItem('theme');
const initialState: AppState = {
  loading: false,
  theme: initialTheme
    ? initialTheme
    : window.matchMedia?.('(prefers-color-scheme: dark)').matches // System default theme color
    ? 'dark'
    : 'light',
  network: '',
  currency: '',
};

/**
 * Reducer and State modifications
 */
export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    // Use the PayloadAction type to declare the contents of `action.payload`
    changeTheme: (state, action: PayloadAction<'dark' | 'light'>) => {
      window.localStorage.setItem('theme', action.payload);
      state.theme = action.payload;
    },
    changeNetwork: (state, action: PayloadAction<string>) => {
      state.network = action.payload.toLowerCase();
    },
    changeCurrency: (state, action: PayloadAction<string>) => {
      state.currency = action.payload.toUpperCase();
    },
  },
});

/**
 * Reducer Export
 */
export default appSlice.reducer;
