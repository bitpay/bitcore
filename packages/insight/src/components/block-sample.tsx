import React, {FC, useState} from 'react';
import {getConvertedValue, getDifficultyFromBits, getFormattedDate} from 'src/utilities/helper-methods';
import {BitcoinBlockType} from 'src/utilities/models';
import BlockGroupDarkSvg from '../assets/images/block-group-dark.svg';
import BlockGroupLightSvg from '../assets/images/block-group-light.svg';
import styled, {CSSProperties, useTheme} from 'styled-components';
import {colorCodes} from 'src/utilities/constants';
import DataBox from './data-box';

const BlockChip = styled.div`
  border: 4px solid ${({theme: {dark}}) => (dark ? '#333' : '#ddd')};
  border-radius: 10px;
  padding: 0.6em;
  background-color: transparent;
  width: 100%;
`;

const BlocksLinkChip = styled.div`
  display: flex;
  border-radius: 15px;
  font: menu;
  width: 150px;
  gap: 0.5rem;
  padding: 0.75rem 0;
  justify-content: center;
  cursor: pointer;
`

const FeeBox: FC<{label: string, value: string}> = ({label, value}) => {
  return (
    <DataBox label={label} style={{borderColor: '#333'}}>
      <>
        <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', width: 'fit-content'}}>
          <span>{value}</span>
          <div style={{width: 'fit-content', display: 'flex', flexDirection: 'column', lineHeight: 1, padding: 0, marginLeft: '3px', marginRight: '-2px'}}>
            <span style={{fontSize: '9px', color: 'gray'}}>sats</span>
            <span style={{
              borderTop: '1px solid #888',
              fontSize: '9px',
              color: 'gray',
              textAlign: 'center',
              marginTop: '1px'
            }}>byte</span>
          </div>
        </div>
      </>
    </DataBox>
  )
}

const DataRow: FC<{label: string, value: any, style?: CSSProperties}> = ({label, value, style}) => {
  return (
    <div style={{justifyContent: 'space-between', width: '100%', display: 'flex', margin: '2px', padding: '6px', borderBottom: '1px solid #444', ...style}}>
      <span>{label}</span>
      <span style={{marginLeft: '8px'}}>{value}</span>
    </div>
  )
}

const BlockSample: FC<{currency: string, blocksList: BitcoinBlockType[]}> = ({currency, blocksList}) => {
  const theme = useTheme();

  const BlockGroupIcon: React.FC<{height?: string | number}> = ({height}) => {
    return (
      <img src={theme.dark ? BlockGroupLightSvg : BlockGroupDarkSvg}
        style={{height: (height ? height : '1.5rem')}}/>
    );
  }

  const [expandedBlocks, setExpandedBlocks] = useState<number[]>([]);

  if (!blocksList?.length) return null;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      {blocksList.map((block: BitcoinBlockType, index: number) => {
        const { height, hash, transactionCount, time, size, merkleRoot, bits, version, nonce, reward } = block;
        const { mean, median, mode, feeTotal } = block.feeData;
        const confirmations = blocksList[0].height - height + 1;
        return (
          <React.Fragment key={index}>
            <div style={{display: 'flex', flexDirection: 'row', gap: '5px', alignItems: 'center', width: '100%'}}>
              {
                !expandedBlocks.includes(height) &&
                <BlocksLinkChip style={{backgroundColor: colorCodes[currency]}} onClick={
                  () => setExpandedBlocks([...expandedBlocks, height])}>
                  <BlockGroupIcon />
                  <b>{height}</b>
                  <BlockGroupIcon />
                </BlocksLinkChip>
              }
              {
                expandedBlocks.includes(height) ? 
                <BlockChip>
                  <b>
                    <div style={{display: 'flex', flexWrap: 'wrap', }}>
                      <div style={{width: '100%', display: 'flex', justifyContent: 'center', marginTop: '-10px'}}>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '0.2rem 0.5rem',
                            gap: '0.5rem',
                            borderRadius: '0 0 20px 20px',
                            cursor: 'pointer',
                            backgroundColor: colorCodes[currency]
                          }}
                          onClick={() => setExpandedBlocks(expandedBlocks.filter(h => h !== height))}
                        >
                          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                            <BlockGroupIcon height={'2rem'}/>
                              <b style={{fontSize: '20px'}}>{height}</b>
                            <BlockGroupIcon height={'2rem'}/>
                          </div>
                          <div style={{width: 'fit-content', height: 'fit-content', font: 'menu', fontSize: '10px', marginTop: '-17px', backgroundColor: colorCodes[currency], padding: '2px', paddingBottom: 0}}>
                            {getFormattedDate(time)}
                          </div>
                        </div>
                      </div>
                      <div style={{width: '50%', minWidth: '700px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', borderRight: '1px solid #555'}}>

                        <div style={{margin: '8px 4px'}}>
                          <DataRow label='Transaction Count' value={transactionCount}/>
                          <DataRow label='Size (kB)' value={size / 1000}/>
                          <DataRow label='Confirmations' value={confirmations}/>
                          <DataRow label='Version' value={version}/>
                        </div>
                        <div style={{margin: '8px 4px'}}>
                          <DataRow label='Reward' value={`${getConvertedValue(reward, currency).toFixed(4)} ${currency}`}/>
                          <DataRow label='Difficulty' value={getDifficultyFromBits(bits)}/>
                          <DataRow label='Bits' value={bits}/>
                          <DataRow label='Nonce' value={nonce}/>
                        </div>
                        <DataBox label='Fee Data' style={{borderWidth: '3px', borderColor: '#333', backgroundColor: '#111', margin: '0.5rem 1rem'}} centerLabel>
                          <>
                            <div style={{margin: '-1rem 0 0 0'}}>
                              <div style={{display: 'flex', marginTop: '0.5rem'}}>
                                <FeeBox label={'Mean'} value={mean.toFixed(4)} />
                                <FeeBox label={'Median'} value={median.toFixed(4)} />
                              </div>
                              <div style={{display: 'flex', marginTop: '-0.5rem'}}>
                                <FeeBox label={'Mode'} value={mode.toFixed(4)} />
                                <DataBox label='Total' style={{borderColor: '#333'}}>
                                  <>
                                    <span>{getConvertedValue(feeTotal, currency).toFixed(3)}</span>
                                    <span style={{fontSize: '12px', color: 'gray'}}> {currency}</span>
                                  </>
                                </DataBox>
                              </div>
                            </div>
                          </>
                        </DataBox>
                        <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center'}}>
                          <DataBox label='Hash' style={{backgroundColor: '#222'}} centerLabel>{hash}</DataBox>
                          <DataBox label='Merkle Root' style={{backgroundColor: '#222'}} centerLabel>{merkleRoot}</DataBox>
                        </div>
                      </div>
                    </div>
                  </b>
                </BlockChip>
                :
                <BlockChip>
                  <b style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    width: '100%',
                  }}>
                    <span>{getFormattedDate(time)}</span>
                    <span>{transactionCount} transactions</span>
                    <span>{size / 1000} kB</span>
                    <span>~{median?.toFixed(4)} sats/Byte</span>
                  </b>
                </BlockChip>
              }
            </div>
            {index !== blocksList.length - 1 && (
              <div style={{display: 'flex', flexDirection: 'row', width: '100%', alignItems: 'center', justifyContent: 'flex-start'}}>
              <div
              style={{
                width: '4px',
                height: '20px',
                borderRadius: '1px',
                background: colorCodes[currency],
                marginLeft: '70px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              />
              </div>
            )}
            
            </React.Fragment>
        );
      })}
    </div>
  );
};

export default BlockSample;
