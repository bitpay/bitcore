import { FC } from 'react';
import styled from 'styled-components';
import CloseLightSvg from 'src/assets/images/close-light.svg'
import {Black, Slate30, White} from '../assets/styles/colors';
import { size } from 'src/utilities/constants';

const PillBubble = styled.div`
  display: flex;
  align-items: center;
  height: 38px;
  padding: 5.5px 7px;
  margin-right: 10px;

  @media screen and (max-width: ${size.mobileL}) {
    height: 30px;
    padding: 6.5px 6px;
    margin-right: 5px;
    margin-left: -3px;
  }
  border-radius: 25px;
  background: ${({theme: {dark}}) => dark ? '#333' : Slate30};
`;

const PillCloseButtonCircle = styled.div`
  background-color: ${({theme: {dark}}) => dark ? '#888' : '#D1D4D7'};
  border-radius: 100%;
  height: 100%;
  cursor: pointer;

  &:hover {
    background-color: #B1B4B7;
  }
`;

const NetworkLabel = styled.span`
  text-transform: capitalize;
  padding: 5px;
  color: ${({theme: {dark}}) => dark ? White : Black};
  font-size: 16px

  @media screen and (max-width: ${size.mobileL}) {
    font-size: 12px;
  }
`;

interface PillProps {
  currency?: string,
  network?: string,
  onCloseClick?: () => void
}

export const Pill: FC<PillProps> = ({ currency, network, onCloseClick }) => {
  const isMobile = () => window.innerWidth < Number(size.mobileL.slice(0, -2));
  return (
    currency ?
      <PillBubble>
        <img src={`https://bitpay.com/img/icon/currencies/${currency}.svg`} alt={currency} style={{height: '100%'}} />
        <NetworkLabel>
          {isMobile() ? (network === 'mainnet' ? 'main' : 'test') : network}
        </NetworkLabel>
        <PillCloseButtonCircle onClick={onCloseClick}>
          <img src={CloseLightSvg} alt='Close' style={{height: '100%', padding: '25%'}} />
        </PillCloseButtonCircle>
      </PillBubble>
    : null
  );
}
