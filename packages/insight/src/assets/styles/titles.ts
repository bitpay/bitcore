import styled from 'styled-components';
import {size} from 'src/utilities/constants';
import {motion} from 'framer-motion';

export const MainTitle = styled(motion.h1)`
  font-style: normal;
  font-weight: 500;
  font-size: 50px;
  line-height: 62px;

  @media screen and (max-width: ${size.tablet}) {
    font-size: 25px;
    line-height: 38px;
  }
`;

export const SecondaryTitle = styled.h2`
  font-style: normal;
  font-weight: bold;
  font-size: 25px;
  line-height: 34px;

  @media screen and (max-width: ${size.tablet}) {
    font-size: 22px;
    line-height: 30px;
  }
`;
