import styled, {css} from 'styled-components';
import {Truncate} from './global';
import {size} from '../../utilities/constants';
import {NeutralSlate, Slate30} from './colors';

interface TileDescriptionProps {
  value?: any;
  noTruncate?: any;
  margin?: string;
  padding?: string;
  width?: string;
  textAlign?: string;
}

interface TileProps {
  withBorderBottom?: any;
  invertedBorderColor?: boolean;
  margin?: string;
  padding?: string;
}

export const Tile = styled.div<TileProps>`
  justify-content: space-between;
  display: flex;
  margin: ${({margin}) => margin || 0};
  padding: ${({padding}) => padding || '10px 0'};

  ${({withBorderBottom, invertedBorderColor}: TileProps) => {
    if (withBorderBottom) {
      return css`
        border-style: solid;
        border-width: 0 0 1px 0;
        border-color: ${({theme: {dark}}) => (dark ? '#1F1F1F' : Slate30)};
      `;
    }

    if (invertedBorderColor) {
      return css`
        border-style: solid;
        border-width: 0 0 1px 0;
        border-color: ${({theme: {dark}}) => (dark ? '#090909' : NeutralSlate)};
      `;
    }
  }};
`;

export const TileDescription = styled.div<TileDescriptionProps>`
  ${({noTruncate}) => {
    if (!noTruncate) {
      return Truncate();
    }
  }};

  font-style: normal;
  font-weight: ${({value}) => (value ? 'normal' : '500')};
  font-size: ${({value}) => (value ? '16px' : '18px')};
  line-height: 25px;
  white-space: nowrap;
  margin: ${({margin}) => margin || 0};
  padding: ${({padding}) => padding || 0};
  width: ${({width}) => width || '100%'};
  text-align: ${({textAlign}) => textAlign || 'left'};
  display: inline;

  @media screen and (max-width: ${size.mobileL}) {
    font-size: ${({value}) => (value ? '14px' : '16px')};
  }
`;

interface TileLinkProps {
  disabled?: boolean;
}

export const TileLink = styled(TileDescription)<TileLinkProps>`
  color: ${({disabled, theme: {colors}}) => (disabled ? 'inherit' : colors.link)};
  cursor: ${({disabled}) => (disabled ? 'default' : 'pointer')};
`;
