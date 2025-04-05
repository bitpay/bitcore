import styled from 'styled-components';
import {size} from 'src/utilities/constants';

interface GripProps {
  columns?: number;
  margin?: string;
}

export const Grid = styled.div<GripProps>`
  display: grid;
  grid-column-gap: 4%;
  grid-template-columns: repeat(${({columns}) => columns || 2}, 48%);
  margin: ${({margin}) => margin || 0};

  @media screen and (max-width: ${size.tablet}) {
    grid-template-columns: repeat(${({columns}) => columns || 1}, 100%);
  }
`;
