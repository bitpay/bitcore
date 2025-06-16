import { FC } from 'react';
import styled, { useTheme } from 'styled-components';
import CloseLightSvg from 'src/assets/images/close-light.svg'
import {Black, Slate30, White} from '../assets/styles/colors';
import { isMobile } from 'src/utilities/helper-methods';

const PillBubble = styled.div`
  display: flex;
  align-items: center;
  ${isMobile() ? 
    `height: 30px;
     padding: 6.5px 6px;
     margin-right: 5px;
     margin-left: -3px;`
    :
    `height: 38px;
     padding: 5.5px 7px;
     margin-right: 10px;`
  }
  border-radius: 25px;
  background: ${() => useTheme().dark ? '#333' : Slate30};
`;

const PillCloseButtonCircle = styled.div`
  background-color: ${() => useTheme().dark ? '#888' : '#D1D4D7'};
  border-radius: 100%;
  height: 100%;
  cursor: pointer;

  &:hover {
    background-color: #B1B4B7;
  }
`;

interface PillProps {
  currency?: string,
  network?: string,
  onCloseClick?: () => void
}

export const Pill: FC<PillProps> = ({ currency, network, onCloseClick }) => {
  const theme = useTheme();

  return (
    currency ?
      <PillBubble>
        <img src={`https://bitpay.com/img/icon/currencies/${currency}.svg`} alt={currency} style={{height: '100%'}} />
        <p style={{textTransform: 'capitalize', color: theme.dark ? White : Black, padding: '5px', fontSize: isMobile() ? '12px' : '16px' }}>
          {isMobile() ? (network === 'mainnet' ? 'main' : 'test') : network}
        </p>
        <PillCloseButtonCircle onClick={onCloseClick}>
          <img src={CloseLightSvg} alt='Close' style={{height: '100%', padding: '25%'}} />
        </PillCloseButtonCircle>
      </PillBubble>
    : null
  );
}
