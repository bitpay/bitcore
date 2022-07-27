import styled, {css} from 'styled-components';
import {device, size} from 'src/utilities/constants';
import {motion} from 'framer-motion';
import {Action, Error, LightBlack, NeutralSlate, Slate, Slate30, Warning, White} from './colors';

export const TransactionTile = styled(motion.div)`
  background-color: ${({theme: {dark}}) => (dark ? LightBlack : NeutralSlate)};
  margin: 0.5rem auto;
  padding: 1rem;
`;

export const TxsPlusSign = styled.span`
  width: 20px;
  height: 20px;
  border-radius: 25px;
  background-color: ${({theme: {dark}}) => (dark ? '#0F0F0F' : '#1A1A1A')};
  text-align: center;
  line-height: 20px;
  color: ${Slate};
  font-size: 20px;
  margin-right: 0.5rem;
  display: inline-block;

  &:hover {
    cursor: pointer;
  }
`;

export const TransactionTileHeader = styled.div`
  display: flex;
`;

export const TransactionTileBody = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  margin: 1rem 0;
`;

interface TransactionTileFlexProps {
  justifyContent?: string;
}

export const TransactionTileFlex = styled.div<TransactionTileFlexProps>`
  display: flex;
  justify-content: ${({justifyContent}: TransactionTileFlexProps) =>
    justifyContent || 'space-between'};
  flex-wrap: wrap;
  align-items: center;

  @media screen and (max-width: ${size.tablet}) {
    justify-content: center;
  }
`;

export enum Type {
  Five = 41.66667,
  One = 8.33333,
  Six = 50,
  Three = 25,
  Nine = 75,
  Twelve = 100,
}

interface TransactionBodyColProps {
  type: any;
  textAlign?: string;
  backgroundColor?: string;
  textTAlign?: string;
  padding?: string;
}

export const TransactionBodyCol = styled.div<TransactionBodyColProps>`
  width: 100%;
  max-width: 100%;
  flex: 0 0 100%;
  padding: ${({padding}) => padding || '1rem'};
  text-align: ${({textAlign}) => textAlign || 'left'};
  background-color: ${({backgroundColor, theme: {dark}}) =>
    backgroundColor || (dark ? '#303030' : Slate30)};

  @media screen and ${device.tablet} {
    ${({textTAlign}) =>
      textTAlign &&
      css`
        text-align: ${textTAlign};
      `};
    flex: 0 0 ${({type}) => Type[type]}%;
    width: ${({type}) => Type[type]}%;
    max-width: ${({type}) => Type[type]}%;
  }
}
`;

interface TransactionChipProps {
  primary?: any;
  warning?: any;
  error?: any;
  margin?: any;
  errorText?: any;
}

export const TransactionChip = styled.div<TransactionChipProps>`
  padding: 0.5rem 1rem;
  background-color: ${({theme: {dark}}) => (dark ? '#303030' : Slate30)};
  font-size: 16px;
  margin: ${({margin}) => margin || 0};
  text-align: center;
  height: 2.5rem;

  ${({primary, warning, error, errorText}) => {
    if (primary) {
      return css`
        color: ${White};
        background-color: ${Action};
      `;
    }

    if (warning) {
      return css`
        color: ${White};
        background-color: ${Warning};
      `;
    }

    if (error) {
      return css`
        color: ${White};
        background-color: ${Error};
      `;
    }

    if (errorText) {
      return css`
        color: ${Error};
      `;
    }
  }};

  @media screen and (max-width: ${size.laptop}) {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media screen and (max-width: ${size.tablet}) {
    font-size: 14px;
    width: 175px;
    margin: 0.5rem;
  }

  @media screen and (max-width: ${size.mobileL}) {
    margin: 0.5rem 0;
  }
`;

interface ArrowDivProps {
  margin: string;
}

export const ArrowDiv = styled.div<ArrowDivProps>`
  width: 25px;
  position: relative;
  margin: ${({margin}) => margin};

  img {
    cursor: pointer;
  }
`;

export const ScriptText = styled.p`
  margin: 0.2rem 0;
`;

export const SpanLink = styled.span`
  &:hover {
    cursor: pointer;
  }
`;
