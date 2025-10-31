import React, {FC, useState} from 'react';
import {getApiRoot, getConvertedValue, getDifficultyFromBits, getFormattedDate} from 'src/utilities/helper-methods';
import {BitcoinBlockType} from 'src/utilities/models';
import Cube from '../assets/images/cube.svg';
import Arrow from '../assets/images/arrow-thin.svg';
import ArrowOutward from '../assets/images/arrow-outward.svg';
import ForwardArrow from '../assets/images/arrow-forward-blue.svg';
import ArrowDown from '../assets/images/arrow-down.svg';
import styled, { useTheme } from 'styled-components';
import InfoCard from './InfoCard';
import InfiniteScroll from 'react-infinite-scroll-component';
import { fetcher } from 'src/api/api';
import InfiniteScrollLoadSpinner from './infinite-scroll-load-spinner';
import Info from './info';
import { useNavigate } from 'react-router-dom';

const BlockListTableRow = styled.tr`
  text-align: center;
  line-height: 45px;

  &:nth-child(odd) {
    background-color: ${({theme: {dark}}) => (dark ? '#2a2a2a' : '#f6f7f9')};
  }

  &:nth-child(even) {
    background-color: ${({theme: {dark}}) => (dark ? '#0f0f0f' : '#e0e4e7')};
  }

  font-size: 16px;
`;


const getBlocksUrl = (currency: string, network: string) => {
  return `${getApiRoot(currency)}/${currency}/${network}/block?limit=200`;
};

const BlockSample: FC<{currency: string, network: string, blocks: BitcoinBlockType[]}> = ({currency, network, blocks}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [expandedBlocks, setExpandedBlocks] = useState<number[]>([]);
  const [blocksList, setBlocksList] = useState(blocks);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);

  const fetchMore = async (_blocksList: BitcoinBlockType[]) => {
    if (!_blocksList.length || !currency || !network) return;
    const since = _blocksList[_blocksList.length - 1].height;
    try {
      const newData: [BitcoinBlockType] = await fetcher(
        `${getBlocksUrl(currency, network)}&since=${since}&paging=height&direction=-1`,
      );
      if (newData?.length) {
        setBlocksList(_blocksList.concat(newData));
      } else {
        setHasMore(false);
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again later.');
    }
  };

  const gotoSingleBlockDetailsView = async (hash: string) => {
    await navigate(`/${currency}/${network}/block/${hash}`);
  };

  if (!blocksList?.length) return null;
  return (
    <>
      {error ? <Info type={'error'} message={error} /> : null}  
      <InfiniteScroll
        next={() => fetchMore(blocksList)}
        hasMore={hasMore}
        loader={<InfiniteScrollLoadSpinner />}
        dataLength={blocksList.length}>
        <table style={{width: '100%', overflowX: 'hidden', borderCollapse: 'collapse'}}>
          <thead>
            <BlockListTableRow>
              <th style={{textAlign: 'left', paddingLeft: '3rem', width: '20%'}}>Height</th>
              <th style={{width: '20%'}}>Timestamp</th>
              <th style={{width: '20%'}}>Transactions</th>
              <th style={{width: '20%'}}>Size</th>
              <th style={{textAlign: 'right', paddingRight: '3rem', width: '20%'}}>Fee Rate</th>
            </BlockListTableRow>
          </thead>
          <tbody>
            <tr />
            {
              blocksList.map((block: BitcoinBlockType, index: number) => {
                const feeData = block.feeData;
                const expanded = expandedBlocks.includes(block.height);
                return (
                  <React.Fragment key={index}>
                    <BlockListTableRow key={index}>
                      <td style={{textAlign: 'left', color: '#2240C4', paddingLeft: '1rem'}}>
                        <span 
                          style={{display: 'flex', alignItems: 'center', gap: '0.5em', width: 'fit-content', cursor: 'pointer'}}
                          onClick={() => expanded
                            ? setExpandedBlocks(expandedBlocks.filter(h => h !== block.height))
                            : setExpandedBlocks([...expandedBlocks, block.height])}>
                          {expanded 
                            ? <img src={ArrowDown} style={{height: '2rem', marginLeft: '-2px', marginRight: '-7px'}} alt='arrow' />
                            : <img src={Arrow} style={{height: '1.8rem', marginRight: '-6px'}} alt='arrow' />
                          }
                          <img src={Cube} style={{height: '1.2rem'}} alt='cube' />
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
                              <hr style={{border: 'none', borderTop: '1px solid #eee', margin: '0 -2rem', marginTop: '-0.8rem'}} />
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
                                  {label: 'Next block', value: <>
                                    {block.height + 1}
                                    <img 
                                      src={ArrowOutward} 
                                      style={{width: '24px', cursor: 'pointer'}} 
                                      onClick={() => gotoSingleBlockDetailsView(blocksList[index - 1].hash)}
                                      alt='Next Block' 
                                      title={`Go to block ${block.height + 1}`}
                                    />
                                  </>},
                                  {label: 'Nonce', value: block.nonce},
                                  {label: 'Confirmations', value: blocksList[0].height - block.height + 1},
                                  {label: 'Difficulty', value: getDifficultyFromBits(block.bits).toFixed(0)},
                                  {label: 'Fee data', value: <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', width: '100%'}}>
                                      {[{label: 'Mean', value: feeData.mean}, {label: 'Median', value: feeData.median}, {label: 'Mode', value: feeData.mode}]
                                        .map(({label, value}, key) => {
                                          return (<React.Fragment key={key}>
                                            <div style={{display: 'flex', flexDirection: 'column', lineHeight: 1.1, marginTop: '-0.4rem'}}>
                                              <span style={{color: theme.dark ? '#888' : '#474d53', alignSelf: 'flex-start', lineHeight: 2, marginBottom: -2, fontSize: '16px'}}>{label}</span>
                                              {value.toFixed(4)}
                                            </div>
                                          </React.Fragment>)
                                        })
                                      }
                                  </div>
                                  }
                                ]}/>
                              </div>
                              <span style={{display: 'flex', alignItems: 'center', width: 'fit-content', cursor: 'pointer'}} onClick={() => gotoSingleBlockDetailsView(block.hash)}>
                                <span style={{color: '#2240C4', marginRight: '0.75rem', fontSize: '18px'}}>View transactions</span>
                                <img src={ForwardArrow} style={{height: '1.75rem'}} alt='arrow' />
                              </span>
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
      </InfiniteScroll>
    </>
  );
};

export default BlockSample;
