import {AnimatePresence, motion} from 'framer-motion';
import {FC, memo, useState} from 'react';
import {CopyToClipboard} from 'react-copy-to-clipboard';
import styled from 'styled-components';
import CopySvg from '../assets/images/copy-icon.svg';
import TickSvg from '../assets/images/tick.svg';

const CopyImg = styled(motion.div)`
  margin: auto 0.25rem;
  display: inline-block;
`;

interface CopyTextProps {
  text: string;
}
const CopyText: FC<CopyTextProps> = ({text}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const onClickCopy = () => {
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const copyAnime = {
    whileHover: {
      cursor: 'pointer',
      scale: 1.2,
      transition: {
        bounce: 0,
        duration: 0.1,
        ease: 'linear',
      },
    },

    initial: {
      opacity: 0,
    },

    animate: {
      opacity: 1,
    },

    exit: {
      opacity: 0,
    },
  };

  return (
    <AnimatePresence>
      {copied ? (
        <CopyImg key='tick' variants={copyAnime} exit='exit' initial='initial' animate='animate'>
          <img src={TickSvg} width={12} height={12} alt='tick' />
        </CopyImg>
      ) : (
        <CopyToClipboard text={text} onCopy={() => onClickCopy()}>
          <CopyImg
            key='copy'
            variants={copyAnime}
            whileHover='whileHover'
            exit='exit'
            initial='initial'
            animate='animate'>
            <img src={CopySvg} width={12} height={12} alt='copy' />
          </CopyImg>
        </CopyToClipboard>
      )}
    </AnimatePresence>
  );
};

export default memo(CopyText);
