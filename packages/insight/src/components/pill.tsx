import { FC } from 'react';
import styled from 'styled-components';
import CloseLightSvg from 'src/assets/images/close-light.svg'
import {Black, Slate30} from '../assets/styles/colors';

const PillBubble = styled.div`
  padding: 7px;
  padding-right: 10px;
  margin-right: 10px;
  display: flex;
  align-items: center;
  height: 40px;
  border-radius: 25px;
  background: ${Slate30};
`;

const PillCloseButtonCircle = styled.div`
  background-color: #D1D4D7;
  border-radius: 100%;
  height: 32px;
  width: 32px;
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
  return (
    currency ?
      <PillBubble>
        <img src={`https://bitpay.com/img/icon/currencies/${currency}.svg`} alt={currency} style={{height: '120%'}} />
        <p style={{textTransform: 'capitalize', color: Black, padding: '5px'}}>{network}</p>
        <PillCloseButtonCircle onClick={onCloseClick}>
          <img src={CloseLightSvg} alt='Close' style={{height: '100%', padding: '9px'}} />
        </PillCloseButtonCircle>
      </PillBubble>
    : null
  );
}
