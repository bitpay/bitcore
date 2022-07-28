import styled, {createGlobalStyle, css} from 'styled-components';
import {Error, Slate, Warning} from './colors';

export const HeaderHeight = '80px';
export const FooterHeight = '57px';

export const HeaderZIndex = 10;

export const Truncate = () => css`
   {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const DisplayFlex = styled.div`
  display: flex;
`;

interface ConfirmationLabelProps {
  warning?: any;
  error?: any;
  greyed?: any;
  padding?: string;
}

export const ConfirmationLabel = styled.span<ConfirmationLabelProps>`
  padding: ${({padding}) => padding || 0};
  ${({warning, error, greyed}) => {
    if (greyed) {
      return css`
        color: ${Slate};
      `;
    }

    if (warning) {
      return css`
        color: ${Warning};
      `;
    }

    if (error) {
      return css`
        color: ${Error};
      `;
    }
  }}
`;

export const GlobalStyles = createGlobalStyle`
  html,
  body {
    padding: 0;
    margin: 0;
    background: ${({theme: {colors}}) => colors.background};
    color:${({theme: {colors}}) => colors.color};
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  * {
    box-sizing: border-box;
    font-family: 'Heebo', Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .currency-masonry-grid {
    display: -webkit-box;
    display: -ms-flexbox;
    display: flex;
    margin: 0 -1rem;
    justify-content: center;
  }

  .currency-masonry-grid_column {
    padding: 1rem;
    max-width: 456px;
  }

  #nprogress .bar {
    height: 4px;
    background: #27c4f5 linear-gradient(to right, #27c4f5, #a307ba, #fd8d32, #70c050, #27c4f5);
    background-size: 500%;
    animation: 2s linear infinite barprogress, .3s fadein;
  }

  @keyframes barprogress {
    0% {
      background-position: 0 0
    }
    to {
      background-position: 125% 0
    }
  }
`;
