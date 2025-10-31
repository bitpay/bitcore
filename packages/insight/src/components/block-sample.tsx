import React, {FC, useState} from 'react';
import {getConvertedValue, getDifficultyFromBits, getFormattedDate} from 'src/utilities/helper-methods';
import {BitcoinBlockType} from 'src/utilities/models';
import Cube from '../assets/images/cube.svg';
import Arrow from '../assets/images/arrow.svg';
import ArrowDown from '../assets/images/arrow-down.svg';
import styled from 'styled-components';
import { LightBlack, NeutralSlate, Slate30 } from 'src/assets/styles/colors';
import InfoCard from './InfoCard';

const BlockListTableRow = styled.tr`
  text-align: center;
  line-height: 45px;

  &:nth-child(even) {
    background-color: ${({theme: {dark}}) => (dark ? LightBlack : Slate30)};
  }

  &:nth-child(odd) {
    background-color: ${({theme: {dark}}) => (dark ? '#090909' : NeutralSlate)};
  }

  font-size: 16px;
`;

const BlockSample: FC<{currency: string, blocksList: BitcoinBlockType[]}> = ({currency, blocksList}) => {
  const [expandedBlocks, setExpandedBlocks] = useState<number[]>([]);

  if (!blocksList?.length) return null;
  return (
    <table style={{width: '100%', overflowX: 'hidden', borderCollapse: 'collapse'}}>
      <thead>
        <BlockListTableRow>
          <th style={{textAlign: 'left', paddingLeft: '3rem'}}>Height</th>
          <th>Timestamp</th>
          <th>Transactions</th>
          <th>Size</th>
          <th style={{textAlign: 'right', paddingRight: '3rem'}}>Fee Rate</th>
        </BlockListTableRow>
      </thead>
      <tbody>
        {
          blocksList.map((block: BitcoinBlockType, index: number) => {
            const feeData = block.feeData;
            const expanded = expandedBlocks.includes(block.height);
            return (
              <React.Fragment key={index}>
                <BlockListTableRow 
                  key={index}
                  onClick={() => expanded
                    ? setExpandedBlocks(expandedBlocks.filter(h => h !== block.height))
                    : setExpandedBlocks([...expandedBlocks, block.height])}>
                  <td style={{textAlign: 'left', color: '#2240C4', paddingLeft: '2rem'}}>
                    <span style={{display: 'flex', alignItems: 'center', gap: '0.5em'}}>
                      {expanded 
                        ? <img src={ArrowDown} style={{height: '2rem', marginLeft: '-0.75rem', marginRight: '-6px'}} alt='arrow' />
                        : <img src={Arrow} style={{height: '1rem', marginRight: '5px'}} alt='arrow' />
                      }
                      <img src={Cube} style={{height: '1rem'}} alt='cube' />
                      {block.height}
                    </span>
                  </td>
                  <td>{getFormattedDate(block.time)}</td>
                  <td>{block.transactionCount}</td>
                  <td>{block.size}</td>
                  <td style={{textAlign: 'right', paddingRight: '3rem'}}>{feeData.median.toFixed(4)}</td>
                </BlockListTableRow>
                {expanded && <>
                    {/* Alternates the color so the data below this row stays the same*/}
                    <BlockListTableRow />  
                    <BlockListTableRow>

                      <td colSpan={5} style={{padding: '1rem 2rem'}}>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                          <InfoCard data={[
                            {label: 'Block Hash', value: block.hash, copyText: true},
                            {label: 'Merkle Root', value: block.merkleRoot, copyText: true},
                          ]}/>
                          <span style={{fontSize: '20px', alignSelf: 'flex-start'}}>Summary</span>
                          <div style={{display: 'flex', gap: '1rem'}}>
                            <InfoCard data={[
                              {label: 'Previous block', value: block.height - 1},
                              {label: 'Bits', value: block.bits},
                              {label: 'Version', value: block.version},
                              {label: 'Block reward', value: `${getConvertedValue(block.reward, currency).toFixed(3)} ${currency}`},
                              {label: 'Miner fees', value: `${getConvertedValue(feeData.feeTotal, currency).toFixed(5)} ${currency}`},
                            ]}/>
                            <InfoCard data={[
                              {label: 'Next block', value: block.height + 1},
                              {label: 'Nonce', value: block.nonce},
                              {label: 'Confirmations', value: blocksList[0].height - block.height + 1},
                              {label: 'Difficulty', value: getDifficultyFromBits(block.bits).toFixed(0)},
                              {label: 'Fee data', value: <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', width: '100%'}}>
                                  {[{label: 'Mean', value: feeData.mean}, {label: 'Median', value: feeData.median}, {label: 'Mode', value: feeData.mode}]
                                    .map(({label, value}, key) => {
                                      return (<React.Fragment key={key}>
                                        <div style={{display: 'flex', flexDirection: 'column', lineHeight: 1.1}}>
                                          <span style={{color: '#474d53', alignSelf: 'flex-start', lineHeight: 2, marginBottom: -2, fontSize: '16px'}}>{label}</span>
                                          {value.toFixed(4)}
                                        </div>
                                      </React.Fragment>)
                                    })
                                  }
                              </div>
                              }
                            ]}/>
                          </div>
                        </div>
                      </td>
                    </BlockListTableRow>
                  </>
                }
              </React.Fragment>
            );
          })
        }
      </tbody>
    </table>
  );
};

export default BlockSample;
