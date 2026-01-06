import {FC} from 'react';
import styled from 'styled-components';
import CloseLightSvg from 'src/assets/images/close.svg'
import {Black, White, Slate30} from '../assets/styles/colors';
import {size} from 'src/utilities/constants';

const PillBubble = styled.div`
  display: flex;
  align-items: center;
  height: 38px;
  padding-left: 5px;
  margin-right: 10px;

  @media screen and (max-width: ${size.mobileL}) {
    height: 25px;
    padding-left: 6px;
    margin-right: 5px;
    margin-left: -3px;
  }
  border-radius: 25px;
  background: ${({theme: {dark}}) => dark ? '#333' : Slate30};
`;

const PillCloseButtonCircle = styled.div`
  background-color: ${({theme: {dark}}) => dark ? '#888' : '#D1D4D7'};
  border-radius: 100%;
  height: 75%;
  align-items: center;
  justify-content: center;
  display: flex;
  aspect-ratio: 1;
  cursor: pointer;

  @media screen and (max-width: ${size.mobileL}) {
    height: 60%;
  }
`;

const PillCloseButtonScope = styled.div`
  background-color: transparent;
  border-radius: 100%;
  height: 100%;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  display: flex;

  &:hover {
    background-color: ${({theme: {dark}}) => dark ? '#222' : '#D8DBDD'};
  }

  &:hover ${PillCloseButtonCircle} {
    background-color: ${({theme: {dark}}) => dark ? '#B1B4B7' : '#ECEFF2'};
  }
`;

const NetworkLabel = styled.span`
  text-transform: capitalize;
  padding-left: 4px;
  color: ${({theme: {dark}}) => dark ? White : Black};
  font-size: 16px;

  @media screen and (max-width: ${size.mobileL}) {
    font-size: 12px;
  }
`;

const CurrencyImg = styled.img`
  height: 75%;
  @media screen and (max-width: ${size.mobileL}) {
    height: 60%;
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
        <CurrencyImg src={`https://bitpay.com/img/icon/currencies/${currency}.svg`} alt={currency} />
        <NetworkLabel>{network}</NetworkLabel>
        <PillCloseButtonScope onClick={onCloseClick}>
          <PillCloseButtonCircle>
            <img src={CloseLightSvg} alt='Close' style={{height: '50%'}} />
          </PillCloseButtonCircle>
        </PillCloseButtonScope>
      </PillBubble>
    : null
  );
}
