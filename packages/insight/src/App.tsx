import React from 'react';
import {BrowserRouter} from 'react-router-dom';
import {SWRConfig} from 'swr';
import {fetcher} from './api/api';
import Body from './components/body';
import {ThemeProvider} from 'styled-components';
import {BitPayDarkTheme, BitPayLightTheme} from './assets/styles/bitpay';
import {GlobalStyles} from './assets/styles/global';
import {useAppSelector} from './utilities/hooks';
import 'nprogress/nprogress.css';
import nProgress from 'nprogress';

function App() {
  const theme = useAppSelector(({APP}) => APP.theme);
  const colorScheme = theme === 'dark' ? BitPayDarkTheme : BitPayLightTheme;
  nProgress.configure({showSpinner: false});

  return (
    <ThemeProvider theme={colorScheme}>
      <GlobalStyles />
      <BrowserRouter basename={'/insight'}>
        <SWRConfig
          value={{
            fetcher,
          }}>
          <Body />
        </SWRConfig>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
