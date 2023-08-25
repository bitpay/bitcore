import Search from './search';
import styled from 'styled-components';
import {device} from '../utilities/constants';
import {AnimatePresence, motion} from 'framer-motion';
import InsightLogo from './icons/insight-logo';
import {useNavigate, useLocation} from 'react-router-dom';
import ThemeChanger from './theme-changer';
import {Feather} from '../assets/styles/colors';
import {HeaderHeight, HeaderZIndex} from '../assets/styles/global';
import {memo} from 'react';

const HeaderDiv = styled.div`
  position: fixed;
  height: ${HeaderHeight};
  width: 100%;
  left: 0;
  top: 0;
  display: flex;
  padding: 1rem calc((100% - 992px) / 4);
  background: ${({theme: {dark}}) => (dark ? '#090909' : Feather)};
  align-items: center;
  z-index: ${HeaderZIndex};
  @media screen and (max-width: 992px) {
    padding: 1rem;
  }
`;

const ImageDiv = styled.div`
  margin-right: 2rem;
  display: flex;

  svg {
    min-width: 89px;
    min-height: 27px;

    &:hover {
      cursor: pointer;
    }
  }
`;

const ToggleDiv = styled.div`
  margin-left: auto;
`;

const DesktopSearch = styled(motion.div)`
  display: none;
  @media screen and ${device.tablet} {
    display: flex;
    width: 100%;
  }
`;

export const fadeInOut = {
  animate: {
    opacity: 1,
    transition: {
      bounce: 0,
      duration: 0.03,
      ease: 'easeOut',
    },
  },
  initial: {
    opacity: 0,
  },
  exit: {
    opacity: 0,
  },
};

const Header = ({setSearchError}: {setSearchError?: any}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const goHome = () => {
    navigate('/');
  };

  return (
    <HeaderDiv>
      <ImageDiv onClick={() => goHome()}>
        <InsightLogo />
      </ImageDiv>
      <AnimatePresence>
        {location.pathname !== '/' && (
          <DesktopSearch variants={fadeInOut} animate='animate' initial='initial' exit='exit'>
            <Search setErrorMessage={setSearchError} />
          </DesktopSearch>
        )}
      </AnimatePresence>

      <ToggleDiv>
        <ThemeChanger />
      </ToggleDiv>
    </HeaderDiv>
  );
};

export default memo(Header);
