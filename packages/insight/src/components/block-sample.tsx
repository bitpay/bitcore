import React, {FC, useState} from 'react';
import {darkenHexColor, getConvertedValue, getDifficultyFromBits, getFormattedDate} from 'src/utilities/helper-methods';
import {BitcoinBlockType} from 'src/utilities/models';
import BlockGroupDarkSvg from '../assets/images/block-group-dark.svg';
import BlockGroupLightSvg from '../assets/images/block-group-light.svg';
import styled, {CSSProperties, useTheme} from 'styled-components';
import {colorCodes} from 'src/utilities/constants';
import DataBox from './data-box';

const BlockDataBox = styled.div`
  border: 4px solid ${({theme: {dark}}) => (dark ? '#333' : '#ddd')};
  border-radius: 10px;
  padding: 0.6em;
  background-color: transparent;
  width: 100%;
`;

const BlockChip = styled.div<{currency: string}>`
  display: flex;
  border-radius: 15px;
  font: menu;
  width: 150px;
  gap: 0.5rem;
  padding: 0.75rem 0;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  background-color: ${({currency}) => colorCodes[currency]};

  &:hover {
    background-color: ${({currency}) => darkenHexColor(colorCodes[currency], 25)}
  }
`
const BlockChipHeader = styled(BlockChip)`
  flex-direction: column;
  padding: 0.2rem 0.5rem;
  border-radius: 0 0 20px 20px;
  width: unset;
  
  .block-chip-date {
    background-color: ${({currency}) => colorCodes[currency]};
  }

  &:hover {
    .block-chip-date {
      background-color: ${({currency}) => darkenHexColor(colorCodes[currency], 25)};
    }
  }
`

const FeeBox: FC<{label: string, value: string}> = ({label, value}) => {
  return (
    <DataBox label={label} colorDark='#333' colorLight='#ccc'>
      <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', width: 'fit-content'}}>
        <span style={{fontWeight: 'bold'}}>{value}</span>
        <div style={{width: 'fit-content', display: 'flex', flexDirection: 'column', lineHeight: 1, padding: 0, marginLeft: '3px', marginRight: '-2px'}}>
          <b style={{fontSize: '9px', color: 'gray'}}>sats</b>
          <b style={{
            borderTop: '1px solid #888',
            fontSize: '9px',
            color: 'gray',
            textAlign: 'center',
            marginTop: '1px'
          }}>byte</b>
        </div>
      </div>
    </DataBox>
  )
}

const DataRow: FC<{label: string, value: any, style?: CSSProperties}> = ({label, value, style}) => {
  return (
    <div style={{justifyContent: 'space-between', width: '100%', display: 'flex', margin: '2px', padding: '6px', borderBottom: '1px solid #444', ...style}}>
      <b>{label}</b>
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
                <BlockChip currency={currency} onClick={
                  () => setExpandedBlocks([...expandedBlocks, height])}>
                  <BlockGroupIcon />
                  <b>{height}</b>
                  <BlockGroupIcon />
                </BlockChip>
              }
              {
                expandedBlocks.includes(height) ? 
                <BlockDataBox>
                  <div style={{display: 'flex', flexWrap: 'wrap', }}>
                    <div style={{width: '100%', display: 'flex', justifyContent: 'center', marginTop: '-10px'}}>
                      <BlockChipHeader
                        currency={currency}
                        onClick={() => setExpandedBlocks(expandedBlocks.filter(h => h !== height))}
                      >
                        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                          <BlockGroupIcon height={'2rem'}/>
                          <b style={{fontSize: '20px'}}>{height}</b>
                          <BlockGroupIcon height={'2rem'}/>
                        </div>
                        <div 
                          className='block-chip-date'
                          style={{
                            width: 'fit-content', 
                            height: 'fit-content', 
                            font: 'menu', 
                            fontSize: '10px', 
                            marginTop: '-17px', 
                            padding: '2px', 
                            paddingBottom: 0}}>
                          {getFormattedDate(time)}
                        </div>
                      </BlockChipHeader>
                    </div>
                    <div style={{width: '50%', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', borderRight: '1px solid #555'}}>
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
                      <DataBox label='Fee Data' style={{borderWidth: '3px', borderColor: theme.dark ? '#333' : '#ccc', backgroundColor: theme.dark ? '#111' : '#f0f0f0', margin: '0.5rem 1rem'}} centerLabel>
                        <div style={{margin: '-1rem 0 0 0'}}>
                          <div style={{display: 'flex', marginTop: '0.5rem'}}>
                            <FeeBox label={'Mean'} value={mean.toFixed(4)} />
                            <FeeBox label={'Median'} value={median.toFixed(4)} />
                          </div>
                          <div style={{display: 'flex', marginTop: '-0.5rem'}}>
                            <FeeBox label={'Mode'} value={mode.toFixed(4)} />
                            <DataBox label='Total' colorDark='#333' colorLight='#ccc'>
                              <b>{getConvertedValue(feeTotal, currency).toFixed(3)}</b>
                              <b style={{fontSize: '12px', color: 'gray'}}> {currency}</b>
                            </DataBox>
                          </div>
                        </div>
                      </DataBox>
                      <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center'}}>
                        <DataBox label='Hash' style={{backgroundColor: theme.dark ? '#222': '#e5e5e5'}} centerLabel>{hash}</DataBox>
                        <DataBox label='Merkle Root' style={{backgroundColor: theme.dark ? '#222' : '#e5e5e5'}} centerLabel>{merkleRoot}</DataBox>
                      </div>
                    </div>
                  </div>
                </BlockDataBox>
                :
                <BlockDataBox>
                  <b style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    width: '100%',
                  }}>
                    <span>{getFormattedDate(time)}</span>
                    <span>{transactionCount} transactions</span>
                    <span>{size / 1000} kB</span>
                    <span>~{median?.toFixed(4)} sats/byte</span>
                  </b>
                </BlockDataBox>
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
