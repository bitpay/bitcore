import {configureStore} from '@reduxjs/toolkit';
import appReducer from './app.reducer';

export const store = configureStore({
  reducer: {
    APP: appReducer,
  },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
