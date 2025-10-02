import React, {FC, useState} from 'react';
import {getConvertedValue, getDifficultyFromBits, getFormattedDate} from 'src/utilities/helper-methods';
import {BitcoinBlockType} from 'src/utilities/models';
import BlockGroupDarkSvg from '../assets/images/block-group-dark.svg';
import BlockGroupLightSvg from '../assets/images/block-group-light.svg';
import styled, {useTheme} from 'styled-components';
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
                      <DataBox label='Hash' style={{backgroundColor: '#222'}}>{hash}</DataBox>
                      <DataBox label='Merkle Root' style={{backgroundColor: '#222'}}>{merkleRoot}</DataBox>
                      <span style={{width: '100%'}}/>

                      <DataBox style={{margin: '1.4rem 0.4rem 0 0.2rem', borderColor: '#333', borderWidth: '3px', backgroundColor: '#222'}}>
                        <>
                          <div style={{margin: '-0.5rem 0 0 0'}}>
                            <DataBox label='Transaction Count' style={{whiteSpace: 'nowrap'}}>{transactionCount}</DataBox>
                            <DataBox label='Size (kB)' style={{whiteSpace: 'nowrap'}}><>{size / 1000}</></DataBox>
                            <DataBox label='Confirmations'>{confirmations}</DataBox>
                            <DataBox label='Version'>{version}</DataBox>
                          </div>
                        </>
                      </DataBox>
                      <DataBox label='Fee' style={{borderWidth: '3px', borderColor: '#333', backgroundColor: '#222'}}>
                        <>
                          <div style={{margin: '-1rem 0 0 0'}}>
                            <DataBox style={{}} label='Mean'>{mean.toFixed(4)}</DataBox>
                            <DataBox label='Median'>{median.toFixed(4)}</DataBox>
                            <DataBox label='Mode'>{mode.toFixed(4)}</DataBox>
                            <DataBox label='Total'>{feeTotal}</DataBox>
                          </div>
                        </>
                      </DataBox>
                      <DataBox style={{margin: '1.4rem 0.4rem 0 0.2rem', borderColor: '#333', borderWidth: '3px', backgroundColor: '#222'}}>
                        <>
                          <div style={{margin: '-0.5rem 0 0 0'}}>
                            <DataBox label='Reward'>{`${getConvertedValue(reward, currency).toFixed(3)} ${currency}`}</DataBox>
                            <DataBox label='Difficulty'>{getDifficultyFromBits(bits)}</DataBox>
                            <DataBox label='Bits'>{bits}</DataBox>
                            <DataBox label='Nonce'>{nonce}</DataBox>
                          </div>
                        </>
                      </DataBox>
                      <span style={{width: '100%'}}/>

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
