import styled, {useTheme} from 'styled-components';
import BitPayLogoDark from '../assets/images/bitpay-logo-white.svg';
import BitPayLogoLight from '../assets/images/bitpay-logo-blue.svg';
import {Feather, SlateDark, White} from '../assets/styles/colors';
import {FooterHeight} from '../assets/styles/global';
import {memo} from 'react';

const FooterDiv = styled.div`
  display: flex;
  padding: 1rem calc((100% - 992px) / 4);
  background: ${({theme: {dark}}) => (dark ? '#090909' : Feather)};
  align-items: center;
  justify-content: space-between;
  height: ${FooterHeight};
  @media screen and (max-width: 992px) {
    padding: 1rem;
  }
`;

const Version = styled.div`
  color: ${({theme: {dark}}) => (dark ? White : SlateDark)};
  font-size: 16px;
  line-height: 25px;
`;

const BitPayLink = styled.div`
  height: 25px;

  &:hover {
    cursor: pointer;
  }
`;

const Footer = () => {
  const theme = useTheme();
  const logoSrc = theme.dark ? BitPayLogoDark : BitPayLogoLight;

  return (
    <FooterDiv>
      <BitPayLink>
        <img
          src={logoSrc}
          alt='BitPay logo'
          height={25}
          width={89}
          onClick={() => window.open('https://bitpay.com', '_blank')}
        />
      </BitPayLink>

      <Version>v9.0.0</Version>
    </FooterDiv>
  );
};

export default memo(Footer);
