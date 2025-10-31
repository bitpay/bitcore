import React, {FC, useState} from 'react';
import {getFormattedDate} from 'src/utilities/helper-methods';
import {BitcoinBlockType} from 'src/utilities/models';
import Cube from '../assets/images/cube.svg';
import Arrow from '../assets/images/arrow.svg';
import ArrowDown from '../assets/images/arrow-down.svg';
import styled from 'styled-components';
import { LightBlack, NeutralSlate, Slate30 } from 'src/assets/styles/colors';
import CopyText from './copy-text';

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
            const { height, time, transactionCount, size, feeData, hash, merkleRoot, bits, nonce } = block;
            const { median } = feeData;
            const expanded = expandedBlocks.includes(height);
            return (
              <React.Fragment key={index}>
                <BlockListTableRow 
                  key={index}
                  onClick={() => expanded
                    ? setExpandedBlocks(expandedBlocks.filter(h => h !== height))
                    : setExpandedBlocks([...expandedBlocks, height])}>
                  <td style={{textAlign: 'left', color: '#2240C4', paddingLeft: '2rem'}}>
                    <span style={{display: 'flex', alignItems: 'center', gap: '0.5em'}}>
                      {expanded 
                        ? <img src={ArrowDown} style={{height: '2rem', marginLeft: '-1rem'}} alt='arrow' />
                        : <img src={Arrow} style={{height: '1rem', marginRight: '5px'}} alt='arrow' />
                      }
                      <img src={Cube} style={{height: '1rem'}} alt='cube' />
                      {height}
                    </span>
                  </td>
                  <td>{getFormattedDate(time)}</td>
                  <td>{transactionCount}</td>
                  <td>{size}</td>
                  <td style={{textAlign: 'right', paddingRight: '3rem'}}>{median.toFixed(4)}</td>
                </BlockListTableRow>
                {expanded && <>
                    {/* Alternates the color so the data below this row stays the same*/}
                    <BlockListTableRow />  
                    <BlockListTableRow>
                      <td colSpan={5} style={{padding: '1rem 2rem'}}>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '100%',
                            backgroundColor: '#fff',
                            padding: '16px',
                            borderRadius: '8px'
                          }}>
                            <span style={{color: '#474d53', alignSelf: 'flex-start', lineHeight: 2, marginBottom: -2}}>Block Hash</span>
                            <div style={{display: 'flex', fontSize: '20px', flexDirection: 'row', justifyContent: 'space-between'}}>
                              {hash}
                              <CopyText text={hash} />
                            </div>
                            <hr style={{border: 'none', borderTop: '1px solid #e0e0e0', margin: '8px 0'}} />
                            <span style={{color: '#474d53', alignSelf: 'flex-start', lineHeight: 2, marginBottom: -2}}>Merkle Root</span>
                            <div style={{display: 'flex', fontSize: '20px', flexDirection: 'row', justifyContent: 'space-between'}}>
                              {merkleRoot}
                              <CopyText text={merkleRoot} />
                            </div>
                          </div>
                          <span style={{fontSize: '20px', alignSelf: 'flex-start'}}>Summary</span>
                          <div style={{display: 'flex', gap: '1rem'}}>
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              width: '50%',
                              backgroundColor: '#fff',
                              padding: '16px',
                              borderRadius: '8px'
                            }}>
                              <span style={{color: '#474d53', alignSelf: 'flex-start', lineHeight: 2, marginBottom: -2}}>Previous Block</span>
                              <div style={{display: 'flex', fontSize: '20px', flexDirection: 'row', justifyContent: 'space-between'}}>
                                {height - 1}
                              </div>
                              <hr style={{border: 'none', borderTop: '1px solid #e0e0e0', margin: '8px 0'}} />
                              <span style={{color: '#474d53', alignSelf: 'flex-start', lineHeight: 2, marginBottom: -2}}>Bits</span>
                              <div style={{display: 'flex', fontSize: '20px', flexDirection: 'row', justifyContent: 'space-between'}}>
                                {bits}
                              </div>
                            </div>

                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              width: '50%',
                              backgroundColor: '#fff',
                              padding: '16px',
                              borderRadius: '8px'
                            }}>
                              <span style={{color: '#474d53', alignSelf: 'flex-start', lineHeight: 2, marginBottom: -2}}>Next Block</span>
                              <div style={{display: 'flex', fontSize: '20px', flexDirection: 'row', justifyContent: 'space-between'}}>
                                {height + 1}
                              </div>
                              <hr style={{border: 'none', borderTop: '1px solid #e0e0e0', margin: '8px 0'}} />
                              <span style={{color: '#474d53', alignSelf: 'flex-start', lineHeight: 2, marginBottom: -2}}>Nonce</span>
                              <div style={{display: 'flex', fontSize: '20px', flexDirection: 'row', justifyContent: 'space-between'}}>
                                {nonce}
                              </div>
                            </div>
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
