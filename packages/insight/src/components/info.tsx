import {FC, memo} from 'react';
import styled, {css} from 'styled-components';
import {motion} from 'framer-motion';
import {NeutralSlate, SlateDark} from '../assets/styles/colors';

interface InfoProps {
  message?: string;
  type: string;
  onClick?: () => void;
  textAlign?: 'center';
}

const Message = styled(motion.div)<{type: string; align?: 'center'}>`
  font-size: 16px;
  margin: 1rem 0;
  padding: 1rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: ${({align}) => align || 'left'};

  ${({type}: {type: string}) => {
    if (type === 'error') {
      return css`
        color: ${({theme: {dark}}) => (dark ? '#FFD8DE' : '#870F21')};
        background-color: ${({theme: {dark}}) => (dark ? '#B51B16' : '#FFD8DE')};
      `;
    }

    if (type === 'warning') {
      return css`
        color: ${({theme: {dark}}) => (dark ? '#FCD39E' : '#A35A05')};
        background-color: ${({theme: {dark}}) => (dark ? '#7A4D12' : '#FEECD4')};
      `;
    }

    if (type === 'info') {
      return css`
        color: ${({theme: {dark}}) => (dark ? NeutralSlate : '#870F21')};
        background-color: ${({theme: {dark}}) => (dark ? SlateDark : NeutralSlate)};
      `;
    }
  }}
`;

const Info: FC<InfoProps> = ({message, type, onClick, textAlign}) => {
  const infoAnime = {
    initial: {
      opacity: 0,
      height: 0,
    },
    animate: {
      opacity: 1,
      height: 'auto',
      cursor: onClick ? 'pointer' : 'inherit',
    },
  };

  message = message || 'Uh Oh, Something went wrong. Please try again.';

  return (
    <Message
      type={type}
      variants={infoAnime}
      initial='initial'
      animate='animate'
      onClick={onClick}
      align={textAlign}>
      {message}
    </Message>
  );
};

export default memo(Info);
