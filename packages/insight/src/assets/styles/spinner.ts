import styled, {keyframes} from 'styled-components';

const Spin = keyframes`
  to {
    transform: rotate(720deg);
  }
`;

export const Spinner = styled.div`
  img {
    animation: ${Spin} 1500ms cubic-bezier(0.5, 0, 0.25, 1) infinite;
    user-select: none;
  }
`;
