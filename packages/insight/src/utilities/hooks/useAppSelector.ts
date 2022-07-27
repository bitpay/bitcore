import {TypedUseSelectorHook, useSelector} from 'react-redux';
import {RootState} from '../../store';

export const useAppSelector = useSelector as TypedUseSelectorHook<RootState>;
