import { FC } from 'react';
import CopyText from './copy-text';
import styled from 'styled-components';


type InfoCardType = {
  data: Array<{label: string, value: any, copyText?: boolean}>,
};

const Card = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  background-color: ${({theme: {dark}}) => dark ? '#222' : '#fff'};
  padding: 14px;
  border-radius: 8px;
`;

const Label = styled.span`
  color: ${({theme: {dark}}) => dark ? '#888' : '#474d53'};
  align-self: flex-start;
  line-height: 1.6;
  margin-bottom: -2;
  font-size: 18px;
`;

const InfoCard: FC<InfoCardType> = ({data}) => {
  return (
    <Card>
      {data.map((d, index) => {
        const { label, value, copyText } = d;
        return (<>
          <Label>{label}</Label>
          <div style={{display: 'flex', fontSize: '20px', flexDirection: 'row', justifyContent: 'space-between'}}>
            {value}
            {copyText && <CopyText text={value} style={{width: '20px', height: '20px', margin: '0 1rem'}} />}
          </div>
          { index !== data.length - 1 && <hr style={{border: 'none', borderTop: '1px solid #eee', margin: '8px -14px'}} /> }
        </>);
      })}
    </Card>
  );
}

export default InfoCard;