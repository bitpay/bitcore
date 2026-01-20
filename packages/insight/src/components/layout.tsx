import {AnimatePresence, motion} from 'framer-motion';
import {lazy, memo, ReactNode, Suspense, useEffect, useMemo, useState} from 'react';
import {Parallax} from 'react-parallax';
import {useLocation} from 'react-router-dom';
import styled, {useTheme} from 'styled-components';
import PlusBackgroundLight from '../assets/images/light/plus-background.svg';
import PlusBackgroundDark from '../assets/images/dark/plus-background.svg';
import {Feather} from '../assets/styles/colors';
import {FooterHeight, HeaderHeight} from '../assets/styles/global';
import {MainTitle} from '../assets/styles/titles';
import {ErrorExitAnime, fadeIn, fadeInTransition, searchAnime} from '../utilities/animations';
import {device} from '../utilities/constants';
import Footer from './footer';
import Header from './header';
const Info = lazy(() => import('./info'));
const Search = lazy(() => import('./search'));

const BodyWrapper = styled.main<{marginTop: boolean}>`
  padding: 1rem calc((100% - 992px) / 4);
  justify-content: space-between;
  margin-bottom: 1rem;

  @media screen and (max-width: 992px) {
    padding: 1rem;
  }

  @media screen and ${device.tablet} {
    margin: ${({marginTop}) => (marginTop ? `${HeaderHeight} auto` : '1rem auto')};
  }
`;

const MobileSearch = styled.div`
  display: flex;
  width: 100%;
  margin-top: ${HeaderHeight};

  padding: 1rem calc((100% - 992px) / 4);
  @media screen and (max-width: 992px) {
    padding: 1rem;
  }

  @media screen and ${device.tablet} {
    display: none;
  }
`;

const HomePageSearch = styled(motion.div)`
  margin-top: ${HeaderHeight};
  padding: 5rem calc((100% - 992px) / 4) 4rem;
  background-size: 100%;
  @media screen and (max-width: 992px) {
    padding: 2rem 1rem;
  }
`;

const BodyWrapperContent = styled(motion.div)`
  overflow-x: hidden;
`;

const BodyContainer = styled.div`
  min-height: calc(100vh - ${HeaderHeight} - ${FooterHeight});
`;

const ParallaxBackgroundHeight = styled.div`
  min-height: 42vh;

  @media screen and (max-width: 1200px) {
    min-height: auto;
  }
`;

const ParallaxDiv = styled(Parallax)`
  background-color: ${({theme: {dark}}) => (dark ? '#090909' : Feather)};
`;

const Layout = ({children}: {children?: ReactNode}) => {
  const theme = useTheme();
  const location = useLocation();

  const url = useMemo(() => (theme.dark ? PlusBackgroundLight : PlusBackgroundDark), [theme.dark]);

  const [searchError, setSearchError] = useState('');
  const [isHomePage, setIsHomePage] = useState<boolean>();
  const [isTestnet, setIsTestnet] = useState<boolean>();

  useEffect(() => {
    setIsHomePage(location.pathname === '/');
    const network = location.pathname.split('/')[2]?.toLowerCase();
    setIsTestnet(!!(network && network !== 'mainnet'));
  }, [location.pathname]);

  return (
    <div>
      <motion.div variants={fadeIn} animate='animate' initial='initial'>
        <Header setSearchError={setSearchError} />
      </motion.div>

      <BodyContainer>
        {isHomePage && (
          <ParallaxDiv bgImage={url} strength={400}>
            <ParallaxBackgroundHeight>
              <HomePageSearch variants={searchAnime} animate='animate' initial='initial'>
                <MainTitle variants={fadeInTransition}>Insight Blockchain Explorer</MainTitle>
                <motion.div variants={fadeInTransition}>
                  <Suspense>
                    <Search borderBottom={true} setErrorMessage={setSearchError} />
                  </Suspense>
                </motion.div>

                <AnimatePresence>
                  {searchError && (
                    <motion.div variants={ErrorExitAnime} exit='exit'>
                      <Suspense>
                        <Info message={searchError} type={'error'} />
                      </Suspense>
                    </motion.div>
                  )}
                </AnimatePresence>
              </HomePageSearch>
            </ParallaxBackgroundHeight>
          </ParallaxDiv>
        )}

        {!isHomePage && (
          <MobileSearch>
            <Suspense>
              <Search borderBottom={true} id='headerSearch' setErrorMessage={setSearchError} />
            </Suspense>
          </MobileSearch>
        )}

        <BodyWrapper marginTop={!isHomePage}>
          <BodyWrapperContent>
            <AnimatePresence>
              {searchError && !isHomePage && (
                <motion.div variants={ErrorExitAnime} exit='exit'>
                  <Suspense>
                    <Info message={searchError} type={'error'} />
                  </Suspense>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {isTestnet && (
                <Suspense>
                  <Info
                    message={'This is a test network. Testnet currencies have no real-world value.'}
                    type={'info'}
                    textAlign={'center'}
                  />
                </Suspense>
              )}
            </AnimatePresence>
            {children}
          </BodyWrapperContent>
        </BodyWrapper>
      </BodyContainer>

      <motion.div variants={fadeIn} animate='animate' initial='initial'>
        <Footer />
      </motion.div>
    </div>
  );
};
export default memo(Layout);
