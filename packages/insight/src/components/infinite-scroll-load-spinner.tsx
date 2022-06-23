import LargeThinSpinner from '../assets/images/large-thin-spinner.svg';
import styled from 'styled-components';
import {Spinner} from '../assets/styles/spinner';

const SpinnerDiv = styled(Spinner)`
  display: flex;
  justify-content: center;
  height: 45px;
  align-items: center;
`;

const InfiniteScrollLoadSpinner = () => {
  return (
    <SpinnerDiv>
      <img src={LargeThinSpinner} height={30} width={30} alt='spinner' />
    </SpinnerDiv>
  );
};

export default InfiniteScrollLoadSpinner;
