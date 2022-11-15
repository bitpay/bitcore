import {SUPPORTED_CURRENCIES} from '../utilities/constants';
import {SecondaryTitle} from '../assets/styles/titles';
import CurrencyTile from '../components/currency-tile';
import Masonry from 'react-masonry-css';
import {motion} from 'framer-motion';
import {routerFadeIn} from '../utilities/animations';
import React, {useEffect} from 'react';
import {useAppDispatch} from '../utilities/hooks';

import {changeCurrency, changeNetwork} from '../store/app.actions';

const Home: React.FC = () => {
  const breakpointColumnsObj = {
    default: 3,
    1200: 2,
    768: 1,
  };
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(changeCurrency(''));
    dispatch(changeNetwork(''));
  }, []);

  return (
    <motion.div variants={routerFadeIn} animate='animate' initial='initial'>
      <SecondaryTitle>Latest Blocks</SecondaryTitle>

      <Masonry
        breakpointCols={breakpointColumnsObj}
        className='currency-masonry-grid'
        columnClassName='currency-masonry-grid_column'>
        {SUPPORTED_CURRENCIES.map(currency => {
          return <CurrencyTile currency={currency} key={currency} />;
        })}
      </Masonry>
    </motion.div>
  );
};

export default Home;
