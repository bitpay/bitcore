import {AnimatePresence, motion} from 'framer-motion';
import {CSSProperties, FC, memo, useState} from 'react';
import {CopyToClipboard} from 'react-copy-to-clipboard';
import styled from 'styled-components';
import CopySvg from '../assets/images/copy-icon.svg';
import TickSvg from '../assets/images/tick.svg';

const CopyImg = styled(motion.div)`
  margin: auto 0.25rem;
  display: inline-block;
  width: 12px;
  height: 12px;
  position: relative;
`;

const IconImage = styled(motion.img)`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

interface CopyTextProps {
  text: string;
  style?: CSSProperties
}
const CopyText: FC<CopyTextProps> = ({text, style}) => {
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
    <CopyImg style={style}>
      <AnimatePresence mode={'wait'}>
        {copied ? (
          <IconImage
            key='tick'
            src={TickSvg}
            alt='tick'
            variants={copyAnime}
            initial='initial'
            animate='animate'
            exit='exit'
          />
        ) : (
          <CopyToClipboard text={text} onCopy={() => onClickCopy()}>
            <IconImage
              key='copy'
              src={CopySvg}
              alt='copy'
              variants={copyAnime}
              initial='initial'
              animate='animate'
              whileHover='whileHover'
            />
          </CopyToClipboard>
        )}
      </AnimatePresence>
    </CopyImg>
  );
};

export default memo(CopyText);
