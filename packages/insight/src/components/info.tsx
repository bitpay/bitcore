import styled, {css} from 'styled-components';
import {motion} from 'framer-motion';
import {Error} from '../assets/styles/colors';

const Message = styled(motion.div)<{type: string}>`
  font-size: 16px;
  margin: 1rem 0;
  padding: 1rem;
  border-radius: 12px;
  display: flex;
  align-items: center;

  ${({type}: {type: string}) => {
    if (type === 'error') {
      return css`
        color: ${Error};
        background-color: #ffd8de;
      `;
    }

    if (type === 'warning') {
      return css`
        color: #856d42;
        background-color: #fbf8e5;
      `;
    }
  }}
`;

const Info = ({message, type}: {message?: string; type: string}) => {
  const infoAnime = {
    initial: {
      opacity: 0,
      height: 0,
    },
    animate: {
      opacity: 1,
      height: 'auto',
    },
  };

  message = message || 'Uh Oh, Something went wrong. Please try again.';

  return (
    <Message type={type} variants={infoAnime} initial='initial' animate='animate'>
      {message}
    </Message>
  );
};

export default Info;
