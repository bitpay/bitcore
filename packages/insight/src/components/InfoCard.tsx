import { FC } from 'react';
import CopyText from './copy-text';


type InfoCardType = {
  data: Array<{label: string, value: any, copyText?: boolean}>,
};

const InfoCard: FC<InfoCardType> = ({data}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      backgroundColor: '#fff',
      padding: '14px',
      borderRadius: '8px'
    }}>
      {data.map((d, index) => {
        const { label, value, copyText } = d;
        return (<>
          <span style={{color: '#474d53', alignSelf: 'flex-start', lineHeight: 1.6, marginBottom: -2, fontSize: '18px'}}>{label}</span>
          <div style={{display: 'flex', fontSize: '20px', flexDirection: 'row', justifyContent: 'space-between'}}>
            {value}
            {copyText && <CopyText text={value} style={{width: '20px', height: '20px', margin: '0 1rem'}} />}
          </div>
          { index !== data.length - 1 && <hr style={{border: 'none', borderTop: '1px solid #e0e0e0', margin: '8px -14px'}} /> }
        </>);
      })}
    </div>
  );
}

export default InfoCard;