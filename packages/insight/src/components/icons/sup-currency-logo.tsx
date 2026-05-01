import styled from 'styled-components';
import {motion, useAnimation} from 'framer-motion';
import {imageFadeIn} from 'src/utilities/animations';
import {getCoinIconUrl} from '../../utilities/constants';

const CurrencyIcon = styled(motion.sup)`
  margin-left: 3px;
`;

const SupCurrencyLogo = ({currency}: {currency: string}) => {
  const animationControls = useAnimation();
  const imgSrc = getCoinIconUrl(currency);

  return (
    <CurrencyIcon variants={imageFadeIn} initial='initial' animate={animationControls}>
      <img
        src={imgSrc}
        width={22}
        height={22}
        alt={currency + ' logo'}
        onLoad={() => animationControls.start('animate')}
      />
    </CurrencyIcon>
  );
};

export default SupCurrencyLogo;
